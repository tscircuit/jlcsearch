import { expect, test } from "bun:test"
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
