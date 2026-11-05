import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  getLinuxProcessorSpecs,
  parseProcessorSpeed,
} from "lib/db/derivedtables/linux-processor-specs"
import { generateLinuxProcessorSpecsMigration } from "../../scripts/generate-linux-processor-specs-migration"

const fixtures: [string, string, unknown, number | null, number | null][] = [
  ["ST STM32MP1", "STM32MP157AAC3", "209MHz;650MHz", 2, 650e6],
  ["ST STM32MP1", "STM32MP151AAC3", "800MHz", 1, 800e6],
  ["ST STM32MP1", "STM32MP135DAE7", "1 GHz", 1, 1e9],
  ["NXP i.MX 8M Nano", "MIMX8MN1DVTJZAA", "750MHz;1500MHz", 1, 1.5e9],
  ["NXP i.MX 8M Nano", "MIMX8MN5DVPIZAA", "750MHz、1.4GHz", 4, 1.4e9],
  ["NXP i.MX 8M Mini", "MIMX8MM4CVTKZAA", "1600MHz", 2, 1.6e9],
  ["NXP i.MX 6", "MCIMX6U5DVM10AD", "1000MHz", 2, 1e9],
  ["TI Sitara AM64x", "AM6411BKCGHAALV", "400MHz, 800MHz", 1, 800e6],
  ["TI Sitara AM64x", "AM6442BSEFHAALV", "1GHz;400MHz;800MHz", 2, 1e9],
  ["TI Sitara AM62x", "AM6232ATCGGAALW", "1.4GHz", 2, 1.4e9],
  ["Rockchip RK3588", "RK3588J", "2GHz", 8, 2e9],
  ["Rockchip RK3399", "RK3399", "1.8GHz", 6, 1.8e9],
  ["Rockchip RK3506", "RK3506B", "24MHz", 3, null],
  ["Rockchip RV1106", "rv1106g3", "-", 1, 1.2e9],
  ["Rockchip RK3568", "RK3568", null, 4, 2e9],
  ["Rockchip RK3568", "RK3568J", "1.4GHz", 4, 1.4e9],
  ["Rockchip RK3568", "RK3568J", null, 4, null],
  ["Allwinner V3S", "V3s", undefined, 1, 1.2e9],
  ["Canaan K230", "K230D", "1.6GHz", 2, 1.6e9],
  ["NXP i.MX 8M Nano", "MIMX8MN9UNKNOWN", "-", null, null],
  ["Unknown", "RK3588", "-", null, null],
]

test.each(fixtures)(
  "application specifications for %s %s",
  (family, mfr, speed, cores, hz) => {
    expect(
      getLinuxProcessorSpecs(family, mfr, { "CPU Maximum Speed": speed }),
    ).toEqual({ cpu_core_count: cores, cpu_speed_hz: hz })
  },
)

const invalid = [
  null,
  undefined,
  {},
  [],
  800,
  "-",
  "",
  "800",
  "0MHz",
  "-1GHz",
  "InfinityGHz",
  "100GHz",
  "1.2.3GHz",
  "800MHz garbage",
  "CPU 800MHz",
  "1e3MHz",
  ".8GHz",
  "8.GHz",
]
test.each(invalid.map((value) => [value] as const))(
  "rejects unknown or malformed speed %j",
  (value) => {
    expect(parseProcessorSpeed(value)).toBeNull()
  },
)

test("migration matches importer, tolerates malformed attributes and preserves existing data", async () => {
  const db = new Database(":memory:")
  try {
    db.exec(
      await Bun.file(
        new URL(
          "../../cf-proxy/migrations/0009_linux_capable_processor.sql",
          import.meta.url,
        ),
      ).text(),
    )
    const rows = [
      ...fixtures.map(([family, mfr, speed, cores, hz]) => ({
        family,
        mfr,
        attributes: JSON.stringify({ "CPU Maximum Speed": speed }),
        cores,
        hz,
      })),
      ...invalid.map((value) => ({
        family: "Unknown",
        mfr: "unknown",
        attributes: JSON.stringify({ "CPU Maximum Speed": value }),
        cores: null,
        hz: null,
      })),
      ...["{broken", "null", "[]", "42", null].map((attributes) => ({
        family: "Unknown",
        mfr: "unknown",
        attributes,
        cores: null,
        hz: null,
      })),
    ]
    rows.forEach((row, id) =>
      db
        .query(
          "INSERT INTO linux_capable_processor (lcsc, mfr, chip_family, stock, price1, attributes) VALUES (?, ?, ?, 123, 4.56, ?)",
        )
        .run(id, row.mfr, row.family, row.attributes),
    )
    const migration = generateLinuxProcessorSpecsMigration()
    expect(
      await Bun.file(
        new URL(
          "../../cf-proxy/migrations/0021_linux_processor_specs.sql",
          import.meta.url,
        ),
      ).text(),
    ).toBe(migration)
    db.exec(migration)
    rows.forEach((row, id) => {
      expect(
        db
          .query(
            "SELECT cpu_core_count, cpu_speed_hz, stock, price1, attributes FROM linux_capable_processor WHERE lcsc = ?",
          )
          .get(id),
      ).toEqual({
        cpu_core_count: row.cores,
        cpu_speed_hz: row.hz,
        stock: 123,
        price1: 4.56,
        attributes: row.attributes,
      })
    })
  } finally {
    db.close()
  }
})
