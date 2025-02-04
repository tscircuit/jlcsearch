import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { fp } from "@tscircuit/footprinter"
import { convertToFootprinterString } from "lib/util/convert-to-footprinter-string"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  jsonResponse: z.any(),
})(async (req, ctx) => {
  // Query distinct package values with the count of components for each package
  const result = await ctx.db
    .selectFrom("components")
    .select("package")
    .select((eb) => eb.fn.count("lcsc").as("count"))
    .groupBy("package")
    .orderBy("count", "desc")
    .having((eb) => eb.fn.count("lcsc"), ">", 6)
    .execute()

  const footprints = result.map((row) => {
    const footprinterString = convertToFootprinterString(row.package)
    let isValidFootprint = false
    try {
      const result = fp.string(footprinterString).circuitJson()
      isValidFootprint = result.length > 0
    } catch (e) {
      isValidFootprint = false
    }

    return {
      package: row.package,
      num_components: row.count,
      footprinter_string: footprinterString,
      tscircuit_accepts: isValidFootprint,
    }
  })

  if (ctx.isApiRequest) {
    return ctx.json({ footprints })
  }

  return ctx.react(
    <div>
      <h2>Package Index</h2>
      <Table
        rows={footprints.map((row) => ({
          ...row,
          tscircuit_accepts: row.tscircuit_accepts ? "✓" : "",
          issue: row.tscircuit_accepts ? (
            ""
          ) : (
            <a
              href={`https://github.com/tscircuit/tscircuit/issues/new?title=Footprint%20issue%20with%20${row.package}&body=I%20think%20this%20footprint%20is%20invalid:%20${row.footprinter_string}`}
            >
              Report issue
            </a>
          ),
        }))}
      />
    </div>,
  )
})
