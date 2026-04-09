import type { Kysely } from "kysely"
import type { DB } from "./db/types"
import {
  queryFilterOptions,
  queryTable,
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
  TABLE_RESPONSE_KEY,
  type FilterOptions,
  type QueryParams,
} from "./handlers"

export interface D1QueryResult {
  data: Record<string, unknown[]>
  tableName: string
  filterOptions?: FilterOptions
}

type D1Handler = (
  db: Kysely<DB>,
  params: QueryParams,
) => Promise<D1QueryResult>

const PROCESSOR_INTERFACES = ["uart", "i2c", "spi", "can", "usb"] as const
const MICROPHONE_SUBCATEGORIES = ["Microphones", "MEMS Microphones"] as const

const parseFiniteNumber = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const extractSmallQuantityPrice = (price: string | null): number => {
  if (!price) return 0
  try {
    const priceObj = JSON.parse(price)
    return Number(priceObj[0]?.price ?? 0) || 0
  } catch {
    return 0
  }
}

const getNonEmptyStrings = (
  rows: Array<Record<string, string | null>>,
  key: string,
): string[] =>
  rows
    .map((row) => row[key]?.trim() ?? "")
    .filter(Boolean)

const getMicrocontrollerListHandler = (
  tableName: "arm_processor" | "risc_v_processor",
  responseKey: "arm_processors" | "risc_v_processors",
  coreFilter: "ARM%" | "RISC-V",
): D1Handler => {
  return async (db, params) => {
    let query = db
      .selectFrom("microcontroller")
      .selectAll()
      .limit(100)
      .orderBy("stock", "desc")

    query =
      coreFilter === "ARM%"
        ? query.where("cpu_core", "like", coreFilter)
        : query.where("cpu_core", "=", coreFilter)

    if (params.package) {
      query = query.where("package", "=", params.package)
    }

    const flashMin = parseFiniteNumber(params.flash_min)
    if (flashMin !== null) {
      query = query.where("flash_size_bytes", ">=", flashMin)
    }

    const ramMin = parseFiniteNumber(params.ram_min)
    if (ramMin !== null) {
      query = query.where("ram_size_bytes", ">=", ramMin)
    }

    switch (params.interface) {
      case "uart":
        query = query.where("has_uart", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "can":
        query = query.where("has_can", "=", 1)
        break
      case "usb":
        query = query.where("has_usb", "=", 1)
        break
    }

    let packageQuery = db
      .selectFrom("microcontroller")
      .select("package")
      .distinct()
      .where("package", "is not", null)
      .orderBy("package")

    packageQuery =
      coreFilter === "ARM%"
        ? packageQuery.where("cpu_core", "like", coreFilter)
        : packageQuery.where("cpu_core", "=", coreFilter)

    const [packages, mcus] = await Promise.all([
      packageQuery.execute(),
      query.execute(),
    ])

    return {
      tableName,
      filterOptions: {
        package: getNonEmptyStrings(
          packages as Array<Record<string, string | null>>,
          "package",
        ),
        interface: [...PROCESSOR_INTERFACES],
      },
      data: {
        [responseKey]: mcus.map((m) => ({
          lcsc: m.lcsc ?? 0,
          mfr: m.mfr ?? "",
          package: m.package ?? "",
          cpu_core: m.cpu_core ?? "",
          cpu_speed_hz: m.cpu_speed_hz ?? 0,
          flash_size_bytes: m.flash_size_bytes ?? 0,
          ram_size_bytes: m.ram_size_bytes ?? 0,
          eeprom_size_bytes: m.eeprom_size_bytes ?? 0,
          gpio_count: m.gpio_count ?? 0,
          has_uart: Boolean(m.has_uart),
          has_i2c: Boolean(m.has_i2c),
          has_spi: Boolean(m.has_spi),
          has_can: Boolean(m.has_can),
          has_usb: Boolean(m.has_usb),
          stock: m.stock ?? 0,
          price1: m.price1 ?? 0,
        })),
      },
    }
  }
}

const SPECIAL_D1_HANDLERS: Record<string, D1Handler> = {
  "/analog_switches/list": async (db, params) => {
    let query = db
      .selectFrom("analog_multiplexer")
      .selectAll()
      .where("num_channels", "<=", 2)
      .limit(100)
      .orderBy("stock", "desc")

    if (params.package) {
      query = query.where("package", "=", params.package)
    }

    const channels = parseFiniteNumber(params.channels)
    if (channels !== null) {
      query = query.where("num_channels", "=", channels)
    }

    const [packages, channelOptions, switches] = await Promise.all([
      db
        .selectFrom("analog_multiplexer")
        .select("package")
        .distinct()
        .where("num_channels", "<=", 2)
        .where("package", "is not", null)
        .orderBy("package")
        .execute(),
      db
        .selectFrom("analog_multiplexer")
        .select("num_channels")
        .distinct()
        .where("num_channels", "<=", 2)
        .where("num_channels", "is not", null)
        .orderBy("num_channels")
        .execute(),
      query.execute(),
    ])

    return {
      tableName: "analog_switch",
      filterOptions: {
        package: getNonEmptyStrings(
          packages as Array<Record<string, string | null>>,
          "package",
        ),
        channels: channelOptions
          .map((row) => row.num_channels)
          .filter((value): value is number => value !== null)
          .map(String),
      },
      data: {
        switches: switches.map((m) => ({
          lcsc: m.lcsc ?? 0,
          mfr: m.mfr ?? "",
          package: m.package ?? "",
          num_channels: m.num_channels ?? 0,
          on_resistance_ohms: m.on_resistance_ohms ?? 0,
          supply_voltage_min: m.supply_voltage_min ?? 0,
          supply_voltage_max: m.supply_voltage_max ?? 0,
          has_spi: Boolean(m.has_spi),
          has_i2c: Boolean(m.has_i2c),
          has_parallel_interface: Boolean(m.has_parallel_interface),
          channel_type: m.channel_type ?? "",
          stock: m.stock ?? 0,
          price1: m.price1 ?? 0,
        })),
      },
    }
  },
  "/arm_processors/list": getMicrocontrollerListHandler(
    "arm_processor",
    "arm_processors",
    "ARM%",
  ),
  "/risc_v_processors/list": getMicrocontrollerListHandler(
    "risc_v_processor",
    "risc_v_processors",
    "RISC-V",
  ),
  "/microphones/list": async (db, params) => {
    let query = db
      .selectFrom("component_catalog")
      .select([
        "lcsc",
        "mfr",
        "package",
        "description",
        "stock",
        "price",
        "subcategory",
      ])
      .where("stock", ">", 0)
      .where("subcategory", "in", [...MICROPHONE_SUBCATEGORIES])
      .orderBy("stock", "desc")
      .limit(100)

    if (params.package) {
      query = query.where("package", "=", params.package)
    }

    if (params.microphone_type && params.microphone_type !== "all") {
      query = query.where("subcategory", "=", params.microphone_type)
    }

    const [packages, microphones] = await Promise.all([
      db
        .selectFrom("component_catalog")
        .select("package")
        .distinct()
        .where("subcategory", "in", [...MICROPHONE_SUBCATEGORIES])
        .where("package", "is not", null)
        .orderBy("package")
        .execute(),
      query.execute(),
    ])

    return {
      tableName: "microphone",
      filterOptions: {
        package: getNonEmptyStrings(
          packages as Array<Record<string, string | null>>,
          "package",
        ),
        microphone_type: ["all", ...MICROPHONE_SUBCATEGORIES],
      },
      data: {
        microphones: microphones
          .map((m) => ({
            lcsc: m.lcsc ?? 0,
            mfr: m.mfr ?? "",
            package: m.package ?? "",
            microphone_type: m.subcategory ?? "",
            description: m.description ?? "",
            stock: m.stock ?? 0,
            price1: extractSmallQuantityPrice(m.price),
          }))
          .filter((m) => m.lcsc !== 0 && m.package !== ""),
      },
    }
  },
  "/categories/list": async (db, params) => {
    let query = db
      .selectFrom("component_catalog")
      .select(["category", "subcategory"])
      .where("category", "is not", null)
      .groupBy(["category", "subcategory"])
      .orderBy("category")
      .orderBy("subcategory")

    if (params.category_name) {
      query = query.where("category", "=", params.category_name)
    }

    const rows = await query.execute()
    const normalizedRows = rows
      .map((row) => ({
        category: row.category?.trim() ?? "",
        subcategory: row.subcategory?.trim() ?? "",
      }))
      .filter((row) => row.category !== "")

    const categories = params.category_name
      ? normalizedRows
      : Array.from(
          normalizedRows.reduce((acc, row) => {
            if (!acc.has(row.category)) {
              acc.set(row.category, row.subcategory)
            }
            return acc
          }, new Map<string, string>()).entries(),
        ).map(([category, subcategory]) => ({ category, subcategory }))

    return {
      tableName: "category",
      filterOptions: {
        category_name: Array.from(new Set(normalizedRows.map((row) => row.category))),
      },
      data: { categories },
    }
  },
  "/footprint_index/list": async (db) => {
    const rows = await db
      .selectFrom("component_catalog")
      .select("package")
      .select((eb) => eb.fn.count<number>("lcsc").as("num_components"))
      .where("package", "is not", null)
      .groupBy("package")
      .having((eb) => eb.fn.count("lcsc"), ">", 10)
      .orderBy("num_components", "desc")
      .execute()

    return {
      tableName: "footprint_index",
      data: {
        footprints: rows
          .map((row) => ({
            package: row.package?.trim() ?? "",
            num_components: row.num_components ?? 0,
            footprinter_string: null,
            tscircuit_accepts: false,
          }))
          .filter((row) => row.package !== ""),
      },
    }
  },
}

/**
 * Gets a D1 handler for the given pathname if one exists
 */
export function getD1Handler(pathname: string): D1Handler | null {
  if (SPECIAL_D1_HANDLERS[pathname]) {
    return SPECIAL_D1_HANDLERS[pathname]
  }

  const tableName = ROUTE_TO_TABLE[pathname]
  if (!tableName) {
    return null
  }

  const config = TABLE_CONFIGS[tableName]
  if (!config) {
    return async (db, params) => {
      const results = await queryTable(db, tableName, params, { filters: {} })
      const responseKey = TABLE_RESPONSE_KEY[tableName] || tableName + "s"
      return {
        data: { [responseKey]: results },
        tableName,
      }
    }
  }

  return async (db, params) => {
    const results = await queryTable(db, tableName, params, config)
    const filterOptions = await queryFilterOptions(db, tableName, config)
    const responseKey = TABLE_RESPONSE_KEY[tableName] || tableName + "s"
    return {
      data: { [responseKey]: results },
      tableName,
      filterOptions,
    }
  }
}

/**
 * List of all supported D1 routes
 */
export const D1_ROUTES = [
  ...Object.keys(ROUTE_TO_TABLE),
  ...Object.keys(SPECIAL_D1_HANDLERS),
]
