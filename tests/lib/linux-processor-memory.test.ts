import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { getLinuxProcessorMemory } from "lib/db/derivedtables/linux-processor-memory"
import { linuxCapableProcessorTableSpec } from "lib/db/derivedtables/linux-capable-processor"
import { generateLinuxProcessorMemoryMigration } from "../../scripts/generate-linux-processor-memory-migration"

const fixtures: [string, string, number | null, number | null][] = [
  ["Allwinner F1C100S", "F1C100S", null, 32],
  ["Allwinner F1C200S", "F1C200S", null, 64],
  ["Allwinner T113", "T113-S3", null, 128],
  ["Allwinner T113", "T113-I", null, null],
  ["Allwinner V3S", "V3s", null, 64],
  ["Allwinner D1", "D1s", null, 64],
  ["Allwinner D1", "D1-H", null, null],
  ["Allwinner F133", "F133-B", null, 64],
  ["Allwinner H3", "H3", null, 0],
  ["Rockchip RV1103", "RV1103G1", null, 64],
  ["Rockchip RV1106", "RV1106G2", null, 128],
  ["Rockchip RV1106", "RV1106G3", null, 256],
  ["Rockchip RV1106", "RV1106", null, null],
  ["Rockchip RK3506", "RK3506G1", null, 64],
  ["Rockchip RK3506", "RK3506G2", null, 128],
  ["Rockchip RK3506", "RK3506B", null, 0],
  ["ST STM32MP1", "STM32MP135DAE7", 168, 0],
  ["ST STM32MP1", "STM32MP153CAA3", 708, 0],
  ["ST STM32MP1", "STM32MP157AAC3T", 708, 0],
  ["NXP i.MX 6UltraLite/ULL", "MCIMX6Y0CVM05AB", 128, 0],
  ["NXP i.MX 8M Mini", "MIMX8MM1CVTKZAA", 288, 0],
  ["NXP i.MX 8M Nano", "MIMX8MN5CVPIZAA", 544, 0],
  ["TI Sitara AM335x", "AM3358BZCZA80", null, 0],
  ["TI Sitara AM437x", "AM4377BZDNA80", null, 0],
  ["TI Sitara AM62x", "AM6231ASGGGAALW", null, 0],
  ["TI Sitara AM62x", "AM625SIP", null, null],
  ["Microchip SAMA5", "ATSAMA5D31A-CU", 128, 0],
  ["Microchip SAMA5", "ATSAMA5D27C-D1G-CU", 128, null],
  ["Microchip SAM9", "SAM9X60D5MT-I/4FB", 68, 64],
  ["Microchip SAM9", "SAM9X60D5M-I/4FB", 68, 64],
  ["Microchip SAM9", "SAM9X60D1G-I/LZB", 68, 128],
  ["Canaan K230", "K230", 4096, 0],
  ["Canaan K230", "K230D", 4096, 128],
  ["Unknown", "F1C100S", null, null],
]

const expectedMemory = (sram: number | null, dram: number | null) => ({
  sram_size_bytes: sram === null ? null : sram * 1024,
  integrated_dram_size_bytes: dram === null ? null : dram * 1024 ** 2,
})

test.each(fixtures)("verified RAM for %s %s", (family, mfr, sram, dram) => {
  expect(getLinuxProcessorMemory(family, mfr)).toEqual(
    expectedMemory(sram, dram),
  )
})

test("importer ignores misleading catalog RAM capacities and preserves source attributes", () => {
  for (const [mfr, manufacturer, ram, sram, dram] of [
    ["H3", "Allwinner", "2GB", null, 0],
    ["STM32MP153CAA3", "STMicroelectronics", "512KB", 708, 0],
    ["MIMX8MN5CVPIZAA", "NXP", "512KB", 544, 0],
    ["RV1106G3", "Rockchip", "2Gb", null, 256],
    ["RK3588", "Rockchip", "32GB", null, null],
  ] as const) {
    const [processor] = linuxCapableProcessorTableSpec.mapToTable([
      {
        lcsc: 1,
        mfr,
        description: "application processor",
        package: "BGA",
        stock: 10,
        price: "1-:10.00",
        extra: JSON.stringify({
          manufacturer,
          attributes: { "RAM Size": ram },
        }),
      } as any,
    ])
    expect(processor).toMatchObject({
      ...expectedMemory(sram, dram),
      attributes: { "RAM Size": ram },
    })
  }
})

test("memory migration matches imports and preserves CPU, inventory and raw attributes", async () => {
  const db = new Database(":memory:")
  try {
    for (const name of [
      "0009_linux_capable_processor.sql",
      "0021_linux_processor_specs.sql",
    ])
      db.exec(
        await Bun.file(
          new URL(`../../cf-proxy/migrations/${name}`, import.meta.url),
        ).text(),
      )
    fixtures.forEach(([family, mfr], i) =>
      db
        .query(`INSERT INTO linux_capable_processor
      (lcsc, mfr, chip_family, stock, price1, cpu_speed_hz, cpu_core_count, attributes)
      VALUES (?, ?, ?, 123, 4.56, 1000000000, 2, ?)`)
        .run(i, mfr, family, i % 2 ? "{broken" : '{"RAM Size":"32GB"}'),
    )
    const before = db
      .query("SELECT * FROM linux_capable_processor ORDER BY lcsc")
      .all()
    const migration = generateLinuxProcessorMemoryMigration()
    expect(
      await Bun.file(
        new URL(
          "../../cf-proxy/migrations/0022_linux_processor_memory.sql",
          import.meta.url,
        ),
      ).text(),
    ).toBe(migration)
    db.exec(migration)
    fixtures.forEach(([, , sram, dram], i) =>
      expect(
        db.query("SELECT * FROM linux_capable_processor WHERE lcsc = ?").get(i),
      ).toEqual({ ...(before[i] as object), ...expectedMemory(sram, dram) }),
    )
  } finally {
    db.close()
  }
})
