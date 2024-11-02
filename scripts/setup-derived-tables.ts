import { sql } from "kysely"
import { getDbClient } from "lib/db/get-db-client"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"
import type { DerivedTableSpec } from "lib/db/derivedtables/types"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

const DERIVED_TABLES: DerivedTableSpec<any>[] = [
  resistorTableSpec,
  capacitorTableSpec,
]

function jsonParseOrNull(strObject: string) {
  try {
    return JSON.parse(strObject)
  } catch (e) {
    return null
  }
}

async function createTable(
  db: KyselyDatabaseInstance,
  spec: DerivedTableSpec<any>,
) {
  // Check if table exists and drop it
  const tableExists = await sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=${spec.tableName}
  `.execute(db)

  if (tableExists.rows.length > 0) {
    await db.schema.dropTable(spec.tableName).execute()
  }

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
  const components = await spec.listCandidateComponents(db).limit(100).execute()

  // Map components to table format
  const mappedComponents = spec.mapToTable(components as any).map((c, i) =>
    c === null
      ? null
      : {
          ...c,
          attributes: jsonParseOrNull(components[i].extra)?.attributes,
        },
  )

  // Insert components
  for (const component of mappedComponents) {
    if (component === null) continue
    const attrStringified = JSON.stringify(component.attributes ?? {})
    await db
      .insertInto(spec.tableName as any)
      .values({
        ...component,
        attributes: attrStringified,
      })
      .execute()
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
