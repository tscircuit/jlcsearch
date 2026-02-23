import { sql } from "kysely"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { getOpenAiClient } from "lib/util/get-openai-client"

const extractSmallQuantityPrice = (price: string | null): string => {
  if (!price) return ""
  try {
    const priceObj = JSON.parse(price)
    return priceObj[0]?.price || ""
  } catch {
    return ""
  }
}

const escapeFts5SearchTerm = (term: string): string => {
  return `"${term.replace(/"/g, '""')}"`
}

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    full: z.boolean().optional(),
    q: z.string().optional(),
    limit: z.string().optional(),
    is_basic: z.boolean().optional(),
    is_preferred: z.boolean().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  const limit = parseInt(req.query.limit ?? "100", 10) || 100
  const q = req.query.q?.trim()

  const executeGeneralSearch = async (searchTerm?: string) => {
    let query = ctx.db
      .selectFrom("components")
      .selectAll()
      .limit(limit)
      .orderBy("stock", "desc")
      .where("stock", ">", 0)

    if (req.query.package) {
      query = query.where("package", "=", req.query.package)
    }
    if (req.query.is_basic) {
      query = query.where("basic", "=", 1)
    }
    if (req.query.is_preferred) {
      query = query.where("preferred", "=", 1)
    }

    if (searchTerm) {
      if (/^c\d+$/i.test(searchTerm)) {
        const lcscNumber = Number.parseInt(searchTerm.slice(1), 10)
        if (!Number.isNaN(lcscNumber)) {
          query = query.where("lcsc", "=", lcscNumber)
        }
      } else {
        const quotedTerm = escapeFts5SearchTerm(searchTerm.toLowerCase())
        const combinedFtsQuery = `mfr:${quotedTerm}* OR ${quotedTerm}*`
        query = query.where(
          sql`lcsc`,
          "in",
          sql`(SELECT CAST(lcsc AS INTEGER) FROM components_fts WHERE components_fts MATCH ${combinedFtsQuery})`,
        )
      }
    }

    const fullComponents = await query.execute()
    const components = fullComponents.map((c) => ({
      lcsc: c.lcsc,
      mfr: c.mfr,
      package: c.package,
      is_basic: Boolean(c.basic),
      is_preferred: Boolean(c.preferred),
      description: c.description,
      stock: c.stock,
      price: extractSmallQuantityPrice(c.price),
    }))

    return ctx.json({ components: req.query.full ? fullComponents : components })
  }

  // 1. Check for OpenAI key
  let openai;
  try {
    openai = getOpenAiClient()
  } catch (err) {
    const isComplex = q && (q.split(" ").length > 1 || /[0-9]/.test(q))
    if (isComplex) {
      return ctx.error(400, {
        error_code: "openai_not_configured",
        message: "OpenAI API key is required for complex queries",
      })
    }
    return executeGeneralSearch(q)
  }

  if (!q) return executeGeneralSearch()

  // 2. OpenAI Routing
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Route electronics search queries to database tables. 
Tables: resistor, capacitor, diode, led, voltage_regulator, microcontroller.
Output format: {"table": string, "filters": object, "q": string}`,
      },
      { role: "user", content: q },
    ],
    response_format: { type: "json_object" },
  })

  const routing = JSON.parse(completion.choices[0].message.content || "{}")

  if (!routing.table || routing.table === "none") {
    return executeGeneralSearch(routing.q || q)
  }

  // 3. Specialized Search
  let specQuery = ctx.db.selectFrom(routing.table as any).selectAll().limit(limit)
  for (const [k, v] of Object.entries(routing.filters || {})) {
    specQuery = specQuery.where(k as any, "=", v as any)
  }

  const results = await specQuery.execute()
  return ctx.json({
    table: routing.table,
    components: results,
  })
})
