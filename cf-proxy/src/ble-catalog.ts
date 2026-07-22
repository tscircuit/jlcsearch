import type { Kysely } from "kysely"
import {
  BLE_CHIP_MFR_PATTERNS,
  BLE_CHIP_SUBCATEGORIES,
  isBleChip,
  isLikelyBareBleChip,
  mapBleFields,
  readComponentAttributes,
} from "../../lib/db/derivedtables/ble-utils"
import type { DB } from "./db/types"
import type { FilterOptions, QueryParams } from "./handlers"

type BleCatalogKind = "chip" | "module"

export interface BleCatalogQueryResult {
  data: Record<string, unknown[]>
  tableName: string
  filterOptions: FilterOptions
}

const STRING_FILTERS = [
  "package",
  "bluetooth_version",
  "core_processor",
  "antenna_type",
] as const

const BOOLEAN_FILTERS = ["has_uart", "has_i2c", "has_spi", "has_usb"] as const

const extractSmallQuantityPrice = (price: string | null): number => {
  if (!price) return 0

  try {
    const priceObj = JSON.parse(price)
    return Number(priceObj[0]?.price ?? 0) || 0
  } catch {
    return 0
  }
}

const getStringOptions = (
  rows: Array<Record<string, unknown>>,
  field: string,
): string[] =>
  Array.from(
    new Set(
      rows
        .map((row) => row[field])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))

const matchesFilters = (
  row: Record<string, unknown>,
  params: QueryParams,
): boolean => {
  for (const field of STRING_FILTERS) {
    const value = params[field]
    if (value && value !== "All" && row[field] !== value) return false
  }

  for (const field of BOOLEAN_FILTERS) {
    const value = params[field]
    if (!value || value === "All") continue

    const expected = value === "true" || value === "1"
    if (Boolean(row[field]) !== expected) return false
  }

  return true
}

export const queryBleCatalog = async (
  db: Kysely<DB>,
  params: QueryParams,
  kind: BleCatalogKind,
): Promise<BleCatalogQueryResult> => {
  let candidateQuery = db.selectFrom("component_catalog").where("stock", ">", 0)

  candidateQuery =
    kind === "module"
      ? candidateQuery.where("subcategory", "=", "Bluetooth Modules")
      : candidateQuery
          .where("subcategory", "in", [...BLE_CHIP_SUBCATEGORIES])
          .where((eb) =>
            eb.or([
              eb("extra", "like", "%Bluetooth%"),
              eb("description", "like", "%Bluetooth%"),
              ...BLE_CHIP_MFR_PATTERNS.map((pattern) =>
                eb("mfr", "like", pattern),
              ),
            ]),
          )

  const candidates = await candidateQuery
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price",
      "basic",
      "preferred",
      "subcategory",
      "extra",
    ])
    .orderBy("stock", "desc")
    .limit(1000)
    .execute()

  const mappedRows = candidates
    .map((row): Record<string, unknown> | null => {
      const component = {
        lcsc: row.lcsc ?? 0,
        mfr: row.mfr ?? "",
        package: row.package ?? "",
        description: row.description ?? "",
        stock: row.stock ?? 0,
        basic: row.basic ?? 0,
        preferred: row.preferred ?? 0,
      }
      const attributes = readComponentAttributes(row.extra) ?? {}
      const isBareChip = isLikelyBareBleChip(component)

      if (kind === "module" && isBareChip) return null
      if (kind === "chip") {
        if (!isBleChip(component, attributes)) return null
        if (row.subcategory === "Bluetooth Modules" && !isBareChip) return null
      }

      const mapped = mapBleFields(component, attributes)
      const antennaType = attributes["Antenna Type"]

      return {
        ...mapped,
        price1: extractSmallQuantityPrice(row.price),
        attributes: JSON.stringify(mapped.attributes),
        ...(kind === "module"
          ? {
              antenna_type:
                typeof antennaType === "string" && antennaType.trim() !== "-"
                  ? antennaType.trim()
                  : null,
            }
          : {}),
      }
    })
    .filter((row): row is Record<string, unknown> => row !== null)

  const optionFields =
    kind === "module"
      ? STRING_FILTERS
      : STRING_FILTERS.filter((field) => field !== "antenna_type")
  const filterOptions = Object.fromEntries(
    optionFields.map((field) => [field, getStringOptions(mappedRows, field)]),
  )
  const tableName = kind === "module" ? "ble_module" : "ble_chip"
  const responseKey = kind === "module" ? "ble_modules" : "ble_chips"

  return {
    tableName,
    filterOptions,
    data: {
      [responseKey]: mappedRows
        .filter((row) => matchesFilters(row, params))
        .slice(0, 100),
    },
  }
}
