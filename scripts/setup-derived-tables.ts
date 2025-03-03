import { sql } from "kysely"
import { getBunDatabaseClient, getDbClient } from "lib/db/get-db-client"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"
import { ledTableSpec } from "lib/db/derivedtables/led"
import { headerTableSpec } from "lib/db/derivedtables/header"
import { adcTableSpec } from "lib/db/derivedtables/adc"
import { analogMultiplexerTableSpec } from "lib/db/derivedtables/analog_multiplexer"
import { ioExpanderTableSpec } from "lib/db/derivedtables/io_expander"
import { diodeTableSpec } from "lib/db/derivedtables/diode"
import { dacTableSpec } from "lib/db/derivedtables/dac"
import { wifiModuleTableSpec } from "lib/db/derivedtables/wifi_module"
import { microcontrollerTableSpec } from "lib/db/derivedtables/microcontroller"
import { voltageRegulatorTableSpec } from "lib/db/derivedtables/voltage_regulator"
import { ledDriverTableSpec } from "lib/db/derivedtables/led_driver"
import type { DerivedTableSpec } from "lib/db/derivedtables/types"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"
import { mosfetTableSpec } from "lib/db/derivedtables/mosfet"
import { ledWithICTableSpec } from "lib/db/derivedtables/led_with_ic"
import { ledDotMatrixDisplayTableSpec } from "lib/db/derivedtables/led_dot_matrix_display"
import { oledDisplayTableSpec } from "lib/db/derivedtables/oled_display"
import { ledSegmentDisplayTableSpec } from "lib/db/derivedtables/led_segment_display"
import { lcdDisplayTableSpec } from "lib/db/derivedtables/lcd_display"

const resetArg = process.argv.indexOf("--reset")
const resetTable = resetArg !== -1 ? process.argv[resetArg + 1] : null
const resetAll = resetArg !== -1 && !resetTable

const DERIVED_TABLES: DerivedTableSpec<any>[] = [
  resistorTableSpec,
  capacitorTableSpec,
  ledTableSpec,
  headerTableSpec,
  adcTableSpec,
  analogMultiplexerTableSpec,
  ioExpanderTableSpec,
  diodeTableSpec,
  dacTableSpec,
  wifiModuleTableSpec,
  microcontrollerTableSpec,
  voltageRegulatorTableSpec,
  ledDriverTableSpec,
  mosfetTableSpec,
  ledWithICTableSpec,
  ledDotMatrixDisplayTableSpec,
  oledDisplayTableSpec,
  ledSegmentDisplayTableSpec,
  lcdDisplayTableSpec,
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
  // Check if table exists
  const tableExists = await sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=${spec.tableName}
  `.execute(db)

  if (tableExists.rows.length > 0) {
    if (!resetAll && resetTable !== spec.tableName) {
      console.log(
        `Table ${spec.tableName} already exists, skipping (use --reset ${spec.tableName} to recreate this table, or --reset with no parameter to recreate all)`,
      )
      return
    }
    await db.schema.dropTable(spec.tableName).execute()
  }

  let tableCreator = db.schema.createTable(spec.tableName)
  for (const col of [
    { name: "lcsc", type: "integer", primaryKey: true },
    { name: "mfr", type: "text" },
    { name: "description", type: "text" },
    { name: "stock", type: "integer" },
    { name: "price1", type: "real" },
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

  const BATCH_SIZE = 1000
  let offset = 0

  while (true) {
    // Get batch of components
    const components = await spec
      .listCandidateComponents(db)
      .offset(offset)
      .limit(BATCH_SIZE)
      .execute()

    if (components.length === 0) break

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

    offset += components.length
    console.log(`Processed ${offset} components for ${spec.tableName}`)
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
