import { sql } from "kysely"
import { Table } from "lib/admin/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

interface IndexInfo {
  name: string
  table: string
  columns: string
  enabled: boolean
}

const AVAILABLE_INDEXES: IndexInfo[] = [
  {
    name: "idx_components_stock_desc",
    table: "components",
    columns: "stock desc",
    enabled: false,
  },
]

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Handle POST request to create index
  if (req.method === "POST") {
    const formData = await req.formData()
    const indexName = formData.get("index_name")
    const index = AVAILABLE_INDEXES.find((idx) => idx.name === indexName)

    if (index) {
      // await sql`
      //   CREATE INDEX IF NOT EXISTS ${sql.raw(index.name)} ON ${sql.raw(index.table)} (${sql.raw(index.columns)})
      // `.execute(ctx.db)
      await ctx.db.schema
        .createIndex(index.name)
        .on(index.table)
        .column(index.columns)
        .execute()

      // Mark index as enabled
      index.enabled = true
    }

    // Redirect back to the same page
    return Response.redirect(req.url)
  }

  // Check which indexes actually exist in the database
  for (const index of AVAILABLE_INDEXES) {
    const result = await sql`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name=${index.name}
      `.execute(ctx.db)

    index.enabled = result.rows.length > 0
  }

  return ctx.react(
    <div>
      <h2>Database Indexes</h2>
      <Table
        rows={AVAILABLE_INDEXES.map((index) => ({
          name: index.name,
          enabled: index.enabled ? "Yes" : "No",
          actions: !index.enabled ? (
            <form
              method="POST"
              style={{ display: "inline", margin: 0, padding: 0, border: 0 }}
            >
              <input type="hidden" name="index_name" value={index.name} />
              <button
                type="submit"
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs"
              >
                Add Index
              </button>
            </form>
          ) : null,
        }))}
      />
    </div>,
  )
})
