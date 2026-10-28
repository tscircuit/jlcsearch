import hostAudit from "lib/db/derivedtables/microcontroller-usb-host-audit.json"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { queryTable, TABLE_CONFIGS } from "../../cf-proxy/src/handlers"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  getMicrocontrollerInterfaces as detect,
  microcontrollerInterfaceAudit,
} from "lib/db/derivedtables/microcontroller-interfaces"
import { microcontrollerTableSpec } from "lib/db/derivedtables/microcontroller"
import { generateMicrocontrollerInterfaceMigration } from "../../scripts/generate-microcontroller-interface-migration"

test("interface counts greater than one and common aliases are detected", () => {
  expect(
    detect("UNKNOWN", { CAN: "2", SPI: "3", I2C: "2", "UART/USART": "4" }, ""),
  ).toMatchObject({
    has_can: true,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
  })
  expect(
    detect(
      "UNKNOWN",
      { FDCAN: "Yes", SPI: "2 channels", "I²C": 2, USART: "3" },
      "",
    ),
  ).toMatchObject({
    has_can: true,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
  })
  expect(detect("UNKNOWN", {}, "FDCAN SPI I²C USART")).toMatchObject({
    has_can: true,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
  })
  expect(
    detect(
      "UNKNOWN",
      { CAN: "No", SPI: "0", I2C: "none", UART: "false" },
      "CAN SPI I2C UART",
    ),
  ).toMatchObject({
    has_can: false,
    has_spi: false,
    has_i2c: false,
    has_uart: false,
  })
  expect(detect("UNKNOWN", {}, "scanning inspiration").has_can).toBe(false)
})

test("host detection distinguishes device, PD, unknown and native host support", () => {
  for (const attrs of [
    {},
    { USB: "Yes" },
    { USB: "USB Type-C Power Delivery" },
    { USB: "No host" },
  ]) {
    expect(
      detect("UNKNOWN", attrs, "USB-to-UART bridge connected to host")
        .has_usb_host,
    ).toBeNull()
  }
  for (const attrs of [
    { "USB Host": "Yes" },
    { "USB OTG": "1" },
    { USB: "Device/Host/OTG" },
    { "Universal Serial Bus": "USB 2.0 OTG" },
  ]) {
    expect(detect("UNKNOWN", attrs, "").has_usb_host).toBe(true)
  }
  expect(detect("UNKNOWN", { USB: "Device Only" }, "").has_usb_host).toBe(false)
  expect(detect("UNKNOWN", { "USB Host": "0" }, "USB").has_usb_host).toBe(false)
  expect(detect("STM32G071CBT6", { "USB Host": "Yes" }, "").has_usb_host).toBe(
    false,
  )
  expect(detect("STM32F103C8T6", { USB: "OTG" }, "").has_usb_host).toBe(false)
  expect(detect(" rp2040 ", {}, "").has_usb_host).toBe(true)
  expect(detect("RP2040-UNVERIFIED", {}, "").has_usb_host).toBeNull()
})

test("manufacturer package tables and revised host specifications override older device-only wording", () => {
  const cases = [
    ["CY8C6244LQI-S4D92", true],
    ["CY8C6244AZI-S4D92", false],
    ["CY8C6347BZI-BLD54", true],
    ["CY8C6347BZI-BLD53", false],
    ["CY8C6347LQI-BLD52", false],
    ["CY8C6245AZI-S3D42", true],
    ["PIC32CM2532LE00048-I/Y8X", true],
    ["PIC32CM2532LE00064-I/5LX", true],
    ["M2354SJFAE", true],
    ["nRF52833-QDAA-R", false],
  ] as const
  for (const [mfr, expected] of cases) {
    expect(detect(mfr, {}, "").has_usb_host).toBe(expected)
  }
})

test("native host support implies USB support during a rebuild", () => {
  const row = microcontrollerTableSpec.mapToTable([
    {
      lcsc: 1,
      mfr: "UNKNOWN",
      description: "",
      stock: 1,
      price: "[]",
      basic: 0,
      preferred: 0,
      package: "QFN",
      extra: JSON.stringify({ attributes: { "USB Host": "Yes" } }),
    } as any,
  ])[0]!
  expect(row.has_usb).toBe(true)
  expect(row.has_usb_host).toBe(true)
})

test("catalog audit accounts for every production row and every decision has evidence", () => {
  expect(hostAudit.parts).toHaveLength(9763)
  expect(new Set(hostAudit.parts.map((row) => row.lcsc)).size).toBe(9763)
  expect(
    new Set(hostAudit.parts.map((row) => row.mfr.trim().toUpperCase())).size,
  ).toBe(9745)
  expect(hostAudit.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(hostAudit.coverage).toEqual({
    host: hostAudit.parts.filter((row) => row.has_usb_host === true).length,
    no_host: hostAudit.parts.filter((row) => row.has_usb_host === false).length,
    unknown: hostAudit.parts.filter((row) => row.has_usb_host === null).length,
  })
  for (const row of hostAudit.parts) {
    if (row.has_usb_host === null) {
      expect(row.reason?.length).toBeGreaterThan(10)
      expect(row.reason).not.toBe(
        "Manufacturer datasheet investigation pending.",
      )
      expect(row.source).toBeNull()
      expect(
        detect(row.mfr, { "USB Host": "Yes" }, "USB host").has_usb_host,
      ).toBeNull()
    } else {
      const source = hostAudit.sources[row.source!]
      expect(["http:", "https:"]).toContain(new URL(source.source_url).protocol)
      expect(source.document.length).toBeGreaterThan(5)
      expect(source.evidence.length).toBeGreaterThan(20)
      expect(source.match_method.length).toBeGreaterThan(10)
      if (source.source_sha256)
        expect(source.source_sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(detect(row.mfr, {}, "").has_usb_host).toBe(row.has_usb_host)
    }
  }
})

test("migration backfills the audited catalog while preserving stock and unknowns", async () => {
  const migration = await Bun.file(
    "cf-proxy/migrations/0018_microcontroller_interfaces.sql",
  ).text()
  expect(migration).toBe(generateMicrocontrollerInterfaceMigration())
  const db = new Database(":memory:")
  try {
    db.exec(
      "CREATE TABLE microcontroller (lcsc INTEGER PRIMARY KEY, mfr TEXT, has_can BOOLEAN, has_spi BOOLEAN, has_i2c BOOLEAN, has_uart BOOLEAN, has_usb BOOLEAN, stock INTEGER)",
    )
    const insert = db.prepare(
      "INSERT INTO microcontroller VALUES (?, ?, 0, 0, 0, 0, 0, 123)",
    )
    for (const row of hostAudit.parts)
      insert.run(row.lcsc, ` ${row.mfr.toLowerCase()} `)
    insert.run(-1, "RP2040-UNVERIFIED")
    db.exec(migration)
    const query = db.prepare(
      "SELECT has_usb_host, has_usb, stock FROM microcontroller WHERE lcsc = ?",
    )
    for (const row of hostAudit.parts) {
      expect(query.get(row.lcsc)).toEqual({
        has_usb_host:
          row.has_usb_host === null ? null : Number(row.has_usb_host),
        has_usb: row.has_usb_host === true ? 1 : 0,
        stock: 123,
      })
    }
    for (const { mfr, source, ...flags } of microcontrollerInterfaceAudit) {
      expect(detect(mfr, {}, "")).toEqual(flags)
      expect(
        db
          .query(
            "SELECT has_can, has_spi, has_i2c, has_uart FROM microcontroller WHERE UPPER(TRIM(mfr)) = ?",
          )
          .get(mfr),
      ).toEqual(
        Object.fromEntries(
          Object.entries(flags)
            .filter(([key]) => key !== "has_usb_host")
            .map(([key, value]) => [key, Number(value)]),
        ),
      )
    }
    expect(query.get(-1)).toEqual({
      has_usb_host: null,
      has_usb: 0,
      stock: 123,
    })
  } finally {
    db.close()
  }
})

test("combined interface filters intersect results and exclude unknown host from Yes and No", async () => {
  const database = new Database(":memory:")
  database.exec(`CREATE TABLE microcontroller (
    lcsc INTEGER, stock INTEGER, has_usb BOOLEAN, has_usb_host BOOLEAN,
    has_can BOOLEAN, has_spi BOOLEAN, has_i2c BOOLEAN, has_uart BOOLEAN
  );
  INSERT INTO microcontroller VALUES
    (1, 100, 1, 1, 1, 1, 1, 1),
    (2, 90, 1, 1, 0, 1, 1, 1),
    (3, 80, 1, 0, 1, 1, 1, 1),
    (4, 70, 1, NULL, 1, 1, 1, 1);`)
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    const query = (params: Record<string, string>) =>
      queryTable(
        db as unknown as Parameters<typeof queryTable>[0],
        "microcontroller",
        params,
        TABLE_CONFIGS.microcontroller,
      )
    expect(
      await query({
        has_can: "true",
        has_spi: "true",
        has_i2c: "true",
        has_uart: "true",
        has_usb: "true",
        has_usb_host: "true",
      }),
    ).toMatchObject([{ lcsc: 1, has_usb_host: true }])
    expect(await query({ has_usb_host: "false" })).toMatchObject([
      { lcsc: 3, has_usb_host: false },
    ])
    expect(await query({ has_usb_host: "" })).toHaveLength(4)
    expect(await query({ has_usb_host: "", has_can: "false" })).toMatchObject([
      { lcsc: 2 },
    ])
  } finally {
    await db.destroy()
  }
})
