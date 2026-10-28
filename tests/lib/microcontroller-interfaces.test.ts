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

test("migration seeds exact audited parts and leaves unknown host capability null", async () => {
  const migration = await Bun.file(
    "cf-proxy/migrations/0018_microcontroller_interfaces.sql",
  ).text()
  expect(migration).toBe(generateMicrocontrollerInterfaceMigration())
  const db = new Database(":memory:")
  try {
    db.exec(
      "CREATE TABLE microcontroller (mfr TEXT, has_can BOOLEAN, has_spi BOOLEAN, has_i2c BOOLEAN, has_uart BOOLEAN, stock INTEGER)",
    )
    for (const row of microcontrollerInterfaceAudit)
      db.run("INSERT INTO microcontroller VALUES (?, 0, 0, 0, 0, 123)", [
        ` ${row.mfr.toLowerCase()} `,
      ])
    db.run(
      "INSERT INTO microcontroller VALUES ('RP2040-UNVERIFIED', 1, 1, 1, 1, 456)",
    )
    for (const row of hostAudit)
      db.run("INSERT INTO microcontroller VALUES (?, 0, 0, 0, 0, 123)", [
        row.mfr,
      ])
    db.exec(migration)
    for (const row of hostAudit) {
      expect(detect(row.mfr, {}, "").has_usb_host).toBe(true)
      expect(
        db
          .query("SELECT has_usb_host FROM microcontroller WHERE mfr = ?")
          .get(row.mfr),
      ).toEqual({ has_usb_host: 1 })
    }

    for (const { mfr, source, ...flags } of microcontrollerInterfaceAudit) {
      expect(detect(mfr, {}, "")).toEqual(flags)
      expect(
        db
          .query(
            "SELECT has_can, has_spi, has_i2c, has_uart, has_usb_host, stock FROM microcontroller WHERE UPPER(TRIM(mfr)) = ?",
          )
          .get(mfr),
      ).toEqual({
        ...Object.fromEntries(
          Object.entries(flags).map(([key, value]) => [key, Number(value)]),
        ),
        stock: 123,
      })
    }
    expect(
      db
        .query(
          "SELECT has_usb_host, stock FROM microcontroller WHERE mfr = 'RP2040-UNVERIFIED'",
        )
        .get(),
    ).toEqual({ has_usb_host: null, stock: 456 })
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
