import { sql } from "kysely"
import { destroyDbClient, getDbClient } from "lib/db/get-db-client"
import { accelerometerTableSpec } from "lib/db/derivedtables/accelerometer"
import { adcTableSpec } from "lib/db/derivedtables/adc"
import { analogMultiplexerTableSpec } from "lib/db/derivedtables/analog_multiplexer"
import { batteryHolderTableSpec } from "lib/db/derivedtables/battery_holder"
import { bjtTransistorTableSpec } from "lib/db/derivedtables/bjt_transistor"
import { bleChipTableSpec } from "lib/db/derivedtables/ble-chip"
import { bleModuleTableSpec } from "lib/db/derivedtables/ble-module"
import { boostConverterTableSpec } from "lib/db/derivedtables/boost_converter"
import { buckBoostConverterTableSpec } from "lib/db/derivedtables/buck_boost_converter"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"
import { dacTableSpec } from "lib/db/derivedtables/dac"
import { diodeTableSpec } from "lib/db/derivedtables/diode"
import {
  dimmConnectorTableSpec,
  sodimmConnectorTableSpec,
} from "lib/db/derivedtables/memory-connector"
import { fpgaTableSpec } from "lib/db/derivedtables/fpga"
import { fpcConnectorTableSpec } from "lib/db/derivedtables/fpc_connector"
import { fuseTableSpec } from "lib/db/derivedtables/fuse"
import { gasSensorTableSpec } from "lib/db/derivedtables/gas_sensor"
import { gyroscopeTableSpec } from "lib/db/derivedtables/gyroscope"
import { headerTableSpec } from "lib/db/derivedtables/header"
import { hdmiPortTableSpec } from "lib/db/derivedtables/hdmi-port"
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
import { photoDiodeTableSpec } from "lib/db/derivedtables/photo-diode"
import { potentiometerTableSpec } from "lib/db/derivedtables/potentiometer"
import { relayTableSpec } from "lib/db/derivedtables/relay"
import { resistorArrayTableSpec } from "lib/db/derivedtables/resistor_array"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { springClampTerminalBlockTableSpec } from "lib/db/derivedtables/spring-clamp-terminal-block"
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
  hdmiPortTableSpec,
  adcTableSpec,
  analogMultiplexerTableSpec,
  ioExpanderTableSpec,
  diodeTableSpec,
  dacTableSpec,
  dimmConnectorTableSpec,
  sodimmConnectorTableSpec,
  wifiModuleTableSpec,
  bleModuleTableSpec,
  bleChipTableSpec,
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
  photoDiodeTableSpec,
  jstConnectorTableSpec,
  wireToBoardConnectorTableSpec,
  springClampTerminalBlockTableSpec,
  fpgaTableSpec,
  batteryHolderTableSpec,
]

type Logger = (message: string) => void

type SourceComponentClassification = {
  basic?: number | null
  preferred?: number | null
  is_extended_promotional?: number | null
}

const jsonParseOrNull = (strObject: string) => {
  try {
    return JSON.parse(strObject)
  } catch {
    return null
  }
}

const createIndexes = async (
  db: KyselyDatabaseInstance,
  spec: DerivedTableSpec<any>,
) => {
  for (const index of spec.indexes ?? []) {
    const columns = index.columns.map(String)
    if (columns.length === 0) continue

    let indexCreator = db.schema
      .createIndex(index.name)
      .ifNotExists()
      .on(spec.tableName)

    indexCreator =
      columns.length === 1
        ? indexCreator.column(columns[0])
        : indexCreator.columns(columns)

    await indexCreator.execute()
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
      await createIndexes(db, spec)
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
    { name: "is_extended_promotional", type: "boolean" },
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
  await createIndexes(db, spec)

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

    const mappedComponents = spec.mapToTable(components as any).map((c, i) => {
      if (c === null) return null

      const sourceComponent = components[i] as SourceComponentClassification & {
        extra?: string | null
      }
      const isExtendedPromotional =
        sourceComponent.is_extended_promotional != null
          ? Boolean(sourceComponent.is_extended_promotional)
          : Boolean(sourceComponent.preferred) &&
            !Boolean(sourceComponent.basic)

      return {
        ...c,
        is_extended_promotional: isExtendedPromotional,
        attributes: jsonParseOrNull(sourceComponent.extra ?? "")?.attributes,
      }
    })

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
  tableNames,
  logger = () => {},
}: {
  db?: KyselyDatabaseInstance
  populate?: boolean
  resetAll?: boolean
  resetTable?: string | null
  tableNames?: string[]
  logger?: Logger
} = {}) => {
  const activeDb = db ?? getDbClient()
  const shouldDestroy = !db
  const requestedTableNames = tableNames
    ? new Set(tableNames)
    : new Set(DERIVED_TABLES.map((table) => table.tableName))
  const knownTableNames = new Set(
    DERIVED_TABLES.map((table) => table.tableName),
  )
  const unknownTableNames = [...requestedTableNames].filter(
    (tableName) => !knownTableNames.has(tableName),
  )

  if (unknownTableNames.length > 0) {
    throw new Error(
      `Unknown derived table${unknownTableNames.length === 1 ? "" : "s"}: ${unknownTableNames.join(", ")}`,
    )
  }

  try {
    for (const tableSpec of DERIVED_TABLES.filter((table) =>
      requestedTableNames.has(table.tableName),
    )) {
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
      await destroyDbClient()
    }
  }
}
