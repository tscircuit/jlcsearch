import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { fp } from "@tscircuit/footprinter"
import { convertToPossibleFootprinterStrings } from "lib/util/convert-to-possible-footprinter-strings"

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
    .having((eb) => eb.fn.count("lcsc"), ">", 10)
    .execute()

  const footprints = result.map((row) => {
    const footprinterStrings = convertToPossibleFootprinterStrings(row.package)
    let validFootprinterString: string | null = null
    for (const footprinterString of footprinterStrings) {
      try {
        const result = fp.string(footprinterString).circuitJson()
        if (result.length > 0) {
          validFootprinterString = footprinterString
          break
        }
      } catch (e) {
        // Do nothing
      }
    }

    return {
      package: row.package,
      num_components: row.count,
      footprinter_string: validFootprinterString,
      tscircuit_accepts: Boolean(validFootprinterString),
    }
  })

  if (ctx.isApiRequest) {
    return ctx.json({ footprints })
  }

  return ctx.react(
    <div>
      <h2>Package Index</h2>
      <div style={{ marginBottom: "1rem" }}>
        Percentage tscircuit accepts w/ string:{" "}
        {(
          (footprints.filter((row) => row.tscircuit_accepts).length /
            footprints.length) *
          100
        ).toFixed(2)}
        %
      </div>
      <Table
        rows={footprints.map((row) => ({
          ...row,
          package: (
            <a
              href={`/components/list?package=${encodeURIComponent(row.package)}`}
            >
              {row.package}
            </a>
          ),
          tscircuit_accepts: row.tscircuit_accepts ? "✓" : "",
          report: row.tscircuit_accepts ? (
            ""
          ) : (
            // Title: "Implement <footprint name>"
            // Description:
            // Here's are components on JLCPCB with this footprint: <link to /components/list?package=<footprint name>>
            // There may be reference dimensions/designs on the [kicad viewer](https://tscircuit.github.io/kicad-viewer)
            // This issue may be eligible for a $10 bounty from the TSCircuit team (please review!)
            <a
              href={`https://github.com/tscircuit/tscircuit/issues/new?title=Implement%20${row.package}&body=Here%27s%20are%20components%20on%20JLCPCB%20with%20this%20footprint%3A%20https%3A%2F%2Fjlcsearch.tscircuit.com%2Fcomponents%2Flist%3Fpackage%3D${encodeURIComponent(row.package)}%0A%0AThere%20may%20be%20reference%20dimensions%2Fdesigns%20on%20the%20%5Bkicad%20viewer%5D%28https%3A%2F%2Ftscircuit.github.io%2Fkicad-viewer%29%0A%0AThis%20issue%20may%20be%20eligible%20for%20a%20%2410%20bounty%20from%20the%20TSCircuit%20team%20%28please%20review%21%29`}
            >
              Create issue ($10)
            </a>
          ),
        }))}
      />
    </div>,
  )
})
