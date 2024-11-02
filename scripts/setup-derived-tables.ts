import { sql } from "kysely"
import { getDbClient } from "lib/db/get-db-client"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import type { DerivedTableSpec } from "lib/db/derivedtables/types"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

const DERIVED_TABLES: DerivedTableSpec<any>[] = [resistorTableSpec]

async function createTable(
  db: KyselyDatabaseInstance,
  spec: DerivedTableSpec<any>,
) {
  let tableCreator = db.schema.createTable(spec.tableName)
  for (const col of [
    { name: "lcsc", type: "integer", primaryKey: true },
    { name: "mfr", type: "text" },
    { name: "description", type: "text" },
    { name: "stock", type: "integer" },
    { name: "in_stock", type: "boolean" },
  ].concat(spec.extraColumns as any, [{ name: "attributes", type: "text" }])) {
    tableCreator = tableCreator.addColumn(
      col.name as string,
      col.type as any,
      (cb) => {
        if ("primaryKey" in col && col.primaryKey) return cb.primaryKey()
        return cb
      },
    )
  }

  await tableCreator.execute()

  // Get candidate components
  const components = await spec.listCandidateComponents(db)

  // Map components to table format
  const mappedComponents = spec.mapToTable(components).filter(Boolean)

  // Insert components
  for (const component of mappedComponents) {
    const attributesJson = JSON.stringify(component.attributes)
    await sql`
      INSERT OR REPLACE INTO ${sql.raw(spec.tableName)}
      (lcsc, mfr, description, stock, in_stock, attributes, ${sql.raw(
        spec.extraColumns.map((col) => col.name).join(", "),
      )})
      VALUES
      (${component.lcsc}, ${component.mfr}, ${component.description}, 
       ${component.stock}, ${component.in_stock}, ${attributesJson},
       ${sql.raw(
         spec.extraColumns
           .map((col) => `${component[col.name as keyof typeof component]}`)
           .join(", "),
       )})
    `.execute(db)
  }
}

async function main() {
  const db = getDbClient()

  for (const tableSpec of DERIVED_TABLES) {
    console.log(`Setting up derived table: ${tableSpec.tableName}`)
    await createTable(db, tableSpec)
    console.log(`Successfully set up ${tableSpec.tableName}`)
  }

  await db.destroy()
}

main().catch(console.error)
