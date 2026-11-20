import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { bleChipTableSpec } from "lib/db/derivedtables/ble-chip"
import { bleModuleTableSpec } from "lib/db/derivedtables/ble-module"

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 77540,
    mfr: "NRF52832-QFAA-R",
    description: "2.4GHz Bluetooth RF Transceiver",
    stock: 100,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 2.5 }]),
    package: "QFN-48-EP(6x6)",
    extra: JSON.stringify({
      attributes: {
        Applications: "Bluetooth;General-purpose ISM>1GHz",
        "Bluetooth Version": "Bluetooth 5.3",
        "CPU Core": "ARM Cortex-M4",
        "Frequency Range": "2.4GHz~2.483GHz",
        "Operating Voltage": "1.7V~3.6V",
        "Data Rate": "2Mbps",
        Interface: "I2C,SPI,UART,USB",
      },
    }),
    ...overrides,
  }) as any

test("BLE chip table maps Bluetooth radio attributes", () => {
  const [chip] = bleChipTableSpec.mapToTable([makeComponent()])

  expect(chip).toMatchObject({
    lcsc: 77540,
    mfr: "NRF52832-QFAA-R",
    bluetooth_version: "5.3",
    core_processor: "ARM Cortex-M4",
    frequency_ghz: 2.4,
    operating_voltage_min: 1.7,
    operating_voltage_max: 3.6,
    data_rate_mbps: 2,
    has_i2c: true,
    has_spi: true,
    has_uart: true,
    has_usb: true,
    is_preferred: true,
    price1: 2.5,
  })
})

test("BLE chip table rejects non-Bluetooth RF transceivers", () => {
  const [chip] = bleChipTableSpec.mapToTable([
    makeComponent({
      mfr: "SX1276",
      description: "LoRa RF transceiver",
      extra: JSON.stringify({
        attributes: {
          Applications: "LoRa;General-purpose ISM<1GHz",
          "Frequency Range": "137MHz~1020MHz",
        },
      }),
    }),
  ])

  expect(chip).toBeNull()
})

test.each(["CC2500RGPR", "ESP32-S2"])(
  "BLE chip table does not classify %s as BLE",
  (mfr) => {
    const [chip] = bleChipTableSpec.mapToTable([
      makeComponent({
        mfr,
        description: "2.4GHz RF transceiver",
        extra: JSON.stringify({ attributes: {} }),
      }),
    ])

    expect(chip).toBeNull()
  },
)

test("BLE chip table recognizes BLE SoC families when metadata is sparse", () => {
  const [chip] = bleChipTableSpec.mapToTable([
    makeComponent({
      description: "",
      extra: JSON.stringify({ attributes: {} }),
    }),
  ])

  expect(chip?.mfr).toBe("NRF52832-QFAA-R")
})

test("BLE module table maps module-specific attributes", () => {
  const [module] = bleModuleTableSpec.mapToTable([
    makeComponent({
      lcsc: 20539408,
      mfr: "VG6328A",
      package: "SMD,16x13.6mm",
      extra: JSON.stringify({
        attributes: {
          "Core IC": "BLE SoC",
          "Bluetooth Version": "BLE 5.2",
          "Antenna Type": "On-Board PCB Antenna",
          Frequency: "2.4GHz",
          "Operating Voltage": "3.3V",
          "Support Interface": "UART;GPIO;I2C",
        },
      }),
    }),
  ])

  expect(module).toMatchObject({
    lcsc: 20539408,
    bluetooth_version: "5.2",
    core_processor: "BLE SoC",
    antenna_type: "On-Board PCB Antenna",
    frequency_ghz: 2.4,
    operating_voltage_min: 3.3,
    operating_voltage_max: 3.3,
    has_uart: true,
    has_i2c: true,
  })
})

test("BLE module and chip tables map current JLCPCB keys and description fallbacks", () => {
  const [moduleFromCurrentKeys] = bleModuleTableSpec.mapToTable([
    makeComponent({
      lcsc: 5340528,
      mfr: "E104-BT52X",
      package: "SMD,13x18mm",
      description:
        "-40℃~+85℃ -93dBm 2.4GHz 2Mbps SMD,13x18mm Bluetooth Modules ROHS",
      extra: JSON.stringify({
        attributes: {
          "Utilized IC / Part": "CC2340R5 chip",
          "Wireless Standard": "Bluetooth 4.2, Bluetooth 5.2",
          "Voltage - Supply": "1.71V~3.8V",
          "Antenna Type": "IPEX interface",
          "Interface Type": "GPIO, PWM, SPI, UART, I2C",
        },
      }),
    }),
  ])

  expect(moduleFromCurrentKeys).toMatchObject({
    lcsc: 5340528,
    core_processor: "CC2340R5",
    bluetooth_version: "5.2",
    antenna_type: "IPEX interface",
    frequency_ghz: 2.4,
    operating_voltage_min: 1.71,
    operating_voltage_max: 3.8,
    data_rate_mbps: 2,
    has_uart: true,
    has_i2c: true,
    has_spi: true,
  })

  const [moduleWithoutExtra] = bleModuleTableSpec.mapToTable([
    makeComponent({
      lcsc: 20539408,
      mfr: "VG6328A",
      package: "SMD,16x13.6mm",
      description:
        "-40℃~+85℃ -92dBm 3.3V 2.4GHz Bluetooth 5.3 On-Board PCB Antenna UART SMD,16x13.6mm Bluetooth Modules ROHS",
      extra: null,
    }),
  ])

  expect(moduleWithoutExtra).toMatchObject({
    lcsc: 20539408,
    bluetooth_version: "5.3",
    antenna_type: "On-Board PCB Antenna",
    frequency_ghz: 2.4,
    operating_voltage_min: 3.3,
    operating_voltage_max: 3.3,
    has_uart: true,
  })

  const [chipWithCoreTwoSpaces] = bleChipTableSpec.mapToTable([
    makeComponent({
      lcsc: 190794,
      mfr: "NRF52840-QIAA-R",
      package: "AQFN-73-EP(7x7)",
      description:
        "-95dBm 1.7V~5.5V 2.4GHz 2.4GHz~2.4835GHz 2Mbps SPI、USB、UART、ADC、I2S、PWM ZigBee、Bluetooth、LoRa、ISM transceiver AQFN-73-EP(7x7) RF Transceiver ICs ROHS",
      extra: JSON.stringify({
        attributes: {
          "Core  IC": "NRF52840 Chip",
          "Data Rate": "500Kbps, 1Mbps, 2Mbps",
        },
      }),
    }),
  ])

  expect(chipWithCoreTwoSpaces).toMatchObject({
    lcsc: 190794,
    core_processor: "NRF52840",
    bluetooth_version: null,
    frequency_ghz: 2.4,
    operating_voltage_min: 1.7,
    operating_voltage_max: 5.5,
    data_rate_mbps: 2,
    has_spi: true,
    has_usb: true,
    has_uart: true,
    has_i2c: false,
  })
})

test("BLE chip table selects current Microcontrollers (MCU/MPU/SOC) subcategory", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (column) => column.primaryKey())
      .addColumn("subcategory", "text", (column) => column.notNull())
      .execute()
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (column) => column.primaryKey())
      .addColumn("category_id", "integer", (column) => column.notNull())
      .addColumn("mfr", "text", (column) => column.notNull())
      .addColumn("description", "text", (column) => column.notNull())
      .addColumn("extra", "text")
      .execute()

    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "Microcontrollers (MCU/MPU/SOC)" },
        { id: 2, subcategory: "Wireless RF Transceivers" },
        { id: 3, subcategory: "Sensors" },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        {
          lcsc: 39831287,
          category_id: 1,
          mfr: "CH592F",
          description: "RISC-V BLE MCU",
          extra: null,
        },
        {
          lcsc: 5219804,
          category_id: 2,
          mfr: "CC2340R52E0RGER",
          description: "Bluetooth 5.3 Wireless MCU",
          extra: null,
        },
        {
          lcsc: 111111,
          category_id: 3,
          mfr: "TMP117",
          description: "Temperature Sensor",
          extra: null,
        },
      ])
      .execute()

    const candidates = await bleChipTableSpec
      .listCandidateComponents(db)
      .execute()
    expect(candidates.map((row) => row.lcsc).sort((a, b) => a - b)).toEqual([
      5219804, 39831287,
    ])
  } finally {
    await db.destroy()
  }
})

test("BLE module and chip tables split bare ICs miscategorized as modules", () => {
  const component = makeComponent({
    lcsc: 2976510,
    mfr: "GR5513BENDU",
    package: "QFN-40(5x5)",
    description: "",
    source_subcategory: "Bluetooth Modules",
    extra: JSON.stringify({ attributes: {} }),
  })

  const [module] = bleModuleTableSpec.mapToTable([component])
  const [chip] = bleChipTableSpec.mapToTable([component])

  expect(module).toBeNull()
  expect(chip?.mfr).toBe("GR5513BENDU")
})

test("BLE module table keeps packaged ESP32 modules out of the chip table", () => {
  const component = makeComponent({
    lcsc: 5361945,
    mfr: "ESP32-WROOM-32E-N8R2",
    package: "LCC-38(18x25.5)",
    source_subcategory: "Bluetooth Modules",
  })

  const [module] = bleModuleTableSpec.mapToTable([component])
  const [chip] = bleChipTableSpec.mapToTable([component])

  expect(module?.mfr).toBe("ESP32-WROOM-32E-N8R2")
  expect(chip).toBeNull()
})
