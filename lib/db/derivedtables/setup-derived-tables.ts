import { sql } from "kysely"
import { getDbClient } from "lib/db/get-db-client"
import { accelerometerTableSpec } from "lib/db/derivedtables/accelerometer"
import { adcTableSpec } from "lib/db/derivedtables/adc"
import { analogMultiplexerTableSpec } from "lib/db/derivedtables/analog_multiplexer"
import { batteryHolderTableSpec } from "lib/db/derivedtables/battery_holder"
import { bjtTransistorTableSpec } from "lib/db/derivedtables/bjt_transistor"
import { boostConverterTableSpec } from "lib/db/derivedtables/boost_converter"
import { buckBoostConverterTableSpec } from "lib/db/derivedtables/buck_boost_converter"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"
import { dacTableSpec } from "lib/db/derivedtables/dac"
import { diodeTableSpec } from "lib/db/derivedtables/diode"
import { fpgaTableSpec } from "lib/db/derivedtables/fpga"
import { fpcConnectorTableSpec } from "lib/db/derivedtables/fpc_connector"
import { fuseTableSpec } from "lib/db/derivedtables/fuse"
import { gasSensorTableSpec } from "lib/db/derivedtables/gas_sensor"
import { gyroscopeTableSpec } from "lib/db/derivedtables/gyroscope"
import { headerTableSpec } from "lib/db/derivedtables/header"
import { ioExpanderTableSpec } from "lib/db/derivedtables/io_expander"
import { jstConnectorTableSpec } from "lib/db/derivedtables/jst_connector"
import { lcdDisplayTableSpec } from "lib/db/derivedtables/lcd_display"
import { ledDotMatrixDisplayTableSpec } from "lib/db/derivedtables/led_dot_matrix_display"
import { ledDriverTableSpec } from "lib/db/derivedtables/led_driver"
import { ledSegmentDisplayTableSpec } from "lib/db/derivedtables/led_segment_display"
import { ledTableSpec } from "lib/db/derivedtables/led"
import { ledWithICTableSpec } from "lib/db/derivedtables/led_with_ic"
import { ldoTableSpec } from "lib/db/derivedtables/ldo"
import { microcontrollerTableSpec } from "lib/db/derivedtables/microcontroller"
import { mosfetTableSpec } from "lib/db/derivedtables/mosfet"
import { oledDisplayTableSpec } from "lib/db/derivedtables/oled_display"
import { pcieM2ConnectorTableSpec } from "lib/db/derivedtables/pcie_m2_connector"
import { potentiometerTableSpec } from "lib/db/derivedtables/potentiometer"
import { relayTableSpec } from "lib/db/derivedtables/relay"
import { resistorArrayTableSpec } from "lib/db/derivedtables/resistor_array"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { switchTableSpec } from "lib/db/derivedtables/switch"
import type { DerivedTableSpec } from "lib/db/derivedtables/types"
import { usbCConnectorTableSpec } from "lib/db/derivedtables/usb_c_connector"
import { voltageRegulatorTableSpec } from "lib/db/derivedtables/voltage_regulator"
import { wifiModuleTableSpec } from "lib/db/derivedtables/wifi_module"
import { wireToBoardConnectorTableSpec } from "lib/db/derivedtables/wire_to_board_connector"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

export const DERIVED_TABLES: DerivedTableSpec<any>[] = [
  resistorTableSpec,
  resistorArrayTableSpec,
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
  ldoTableSpec,
  ledDriverTableSpec,
  boostConverterTableSpec,
  buckBoostConverterTableSpec,
  mosfetTableSpec,
  gyroscopeTableSpec,
  accelerometerTableSpec,
  gasSensorTableSpec,
  ledWithICTableSpec,
  ledDotMatrixDisplayTableSpec,
  oledDisplayTableSpec,
  ledSegmentDisplayTableSpec,
  lcdDisplayTableSpec,
  potentiometerTableSpec,
  fuseTableSpec,
  bjtTransistorTableSpec,
  switchTableSpec,
  relayTableSpec,
  fpcConnectorTableSpec,
  usbCConnectorTableSpec,
  pcieM2ConnectorTableSpec,
  jstConnectorTableSpec,
  wireToBoardConnectorTableSpec,
  fpgaTableSpec,
  batteryHolderTableSpec,
]

type Logger = (message: string) => void

const jsonParseOrNull = (strObject: string) => {
  try {
    return JSON.parse(strObject)
  } catch {
    return null
  }
}

const createTable = async (
  db: KyselyDatabaseInstance,
  spec: DerivedTableSpec<any>,
  {
    populate,
    resetAll,
    resetTable,
    logger,
  }: {
    populate: boolean
    resetAll: boolean
    resetTable: string | null
    logger: Logger
  },
) => {
  const tableExists = await sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=${spec.tableName}
  `.execute(db)

  if (tableExists.rows.length > 0) {
    if (!resetAll && resetTable !== spec.tableName) {
      logger(
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

  if (!populate) {
    return
  }

  const BATCH_SIZE = 1000
  let offset = 0

  while (true) {
    const components = await spec
      .listCandidateComponents(db)
      .offset(offset)
      .limit(BATCH_SIZE)
      .execute()

    if (components.length === 0) break

    const mappedComponents = spec.mapToTable(components as any).map((c, i) =>
      c === null
        ? null
        : {
            ...c,
            attributes: jsonParseOrNull(components[i].extra)?.attributes,
          },
    )

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
    logger(`Processed ${offset} components for ${spec.tableName}`)
  }
}

export const setupDerivedTables = async ({
  db,
  populate = true,
  resetAll = false,
  resetTable = null,
  logger = () => {},
}: {
  db?: KyselyDatabaseInstance
  populate?: boolean
  resetAll?: boolean
  resetTable?: string | null
  logger?: Logger
} = {}) => {
  const activeDb = db ?? getDbClient()
  const shouldDestroy = !db

  try {
    for (const tableSpec of DERIVED_TABLES) {
      logger(`Setting up derived table: ${tableSpec.tableName}`)
      await createTable(activeDb, tableSpec, {
        populate,
        resetAll,
        resetTable,
        logger,
      })
      logger(`Successfully set up ${tableSpec.tableName}`)
    }
  } finally {
    if (shouldDestroy) {
      await activeDb.destroy()
    }
  }
}
