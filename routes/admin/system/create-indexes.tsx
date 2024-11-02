import { Table } from "lib/admin/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { componentStockIndex } from "lib/db/optimizations/component-stock-index"
import { removeStaleComponents } from "lib/db/optimizations/remove-stale-components"
import type { DbOptimizationSpec } from "lib/db/optimizations/types"

const OPTIMIZATIONS: DbOptimizationSpec[] = [componentStockIndex, removeStaleComponents]

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Handle POST request to add optimization
  if (req.method === "POST") {
    const formData = await req.formData()
    const optName = formData.get("optimization_name")
    const optimization = OPTIMIZATIONS.find((opt) => opt.name === optName)

    if (optimization) {
      await optimization.execute(ctx.db)
    }

    return Response.redirect(req.url)
  }

  // Check which optimizations exist
  const optimizationStates = await Promise.all(
    OPTIMIZATIONS.map(async (opt) => ({
      name: opt.name,
      description: opt.description,
      enabled: await opt.checkIfAdded(ctx.db),
    })),
  )

  return ctx.react(
    <div>
      <h2>Database Optimizations</h2>
      <Table
        rows={optimizationStates.map((opt) => ({
          name: opt.name,
          description: opt.description,
          enabled: opt.enabled ? "Yes" : "No",
          actions: !opt.enabled ? (
            <form
              method="POST"
              style={{ display: "inline", margin: 0, padding: 0, border: 0 }}
            >
              <input type="hidden" name="optimization_name" value={opt.name} />
              <button
                type="submit"
                className="bg-green-500               
 hover:bg-green-700 text-white font-bold py-1 px-2     
 rounded text-xs"
              >
                Add Optimization
              </button>
            </form>
          ) : null,
        }))}
      />
    </div>,
  )
})
