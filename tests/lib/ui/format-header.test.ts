import { test, expect } from "bun:test"
import { formatHeader } from "lib/ui/Table"

test("formatHeader converts well-known abbreviations to uppercase", () => {
  expect(formatHeader("lcsc")).toBe("LCSC")
  expect(formatHeader("mfr")).toBe("MFR")
  expect(formatHeader("mpn")).toBe("MPN")
  expect(formatHeader("gpio")).toBe("GPIO")
  expect(formatHeader("eeprom")).toBe("EEPROM")
  expect(formatHeader("fpga")).toBe("FPGA")
  expect(formatHeader("ldo")).toBe("LDO")
  expect(formatHeader("ram")).toBe("RAM")
})

test("formatHeader converts snake_case keys to Title Case", () => {
  expect(formatHeader("is_basic")).toBe("Is Basic")
  expect(formatHeader("is_preferred")).toBe("Is Preferred")
  expect(formatHeader("is_smd")).toBe("Is SMD")
  expect(formatHeader("forward_voltage")).toBe("Forward Voltage")
  expect(formatHeader("forward_current")).toBe("Forward Current")
  expect(formatHeader("gate_threshold_voltage")).toBe("Gate Threshold Voltage")
  expect(formatHeader("power_dissipation")).toBe("Power Dissipation")
  expect(formatHeader("on_resistance")).toBe("On Resistance")
  expect(formatHeader("reverse_voltage")).toBe("Reverse Voltage")
  expect(formatHeader("drain_source_voltage")).toBe("Drain Source Voltage")
  expect(formatHeader("tolerance_fraction")).toBe("Tolerance Fraction")
  expect(formatHeader("power_watts")).toBe("Power Watts")
  expect(formatHeader("temp_range")).toBe("Temp Range")
  expect(formatHeader("contact_type")).toBe("Contact Type")
  expect(formatHeader("display_size")).toBe("Display Size")
  expect(formatHeader("sensor_type")).toBe("Sensor Type")
  expect(formatHeader("tx_power")).toBe("TX Power")
})

test("formatHeader preserves already-capitalised keys", () => {
  expect(formatHeader("Package")).toBe("Package")
  expect(formatHeader("Stock")).toBe("Stock")
  expect(formatHeader("Description")).toBe("Description")
})

test("formatHeader handles simple lowercase words", () => {
  expect(formatHeader("voltage")).toBe("Voltage")
  expect(formatHeader("current")).toBe("Current")
  expect(formatHeader("power")).toBe("Power")
  expect(formatHeader("price")).toBe("Price")
  expect(formatHeader("stock")).toBe("Stock")
  expect(formatHeader("resistance")).toBe("Resistance")
  expect(formatHeader("capacitance")).toBe("Capacitance")
  expect(formatHeader("tolerance")).toBe("Tolerance")
  expect(formatHeader("package")).toBe("Package")
  expect(formatHeader("description")).toBe("Description")
  expect(formatHeader("color")).toBe("Color")
  expect(formatHeader("type")).toBe("Type")
})

test("formatHeader handles abbreviations inside compound keys", () => {
  expect(formatHeader("gpio_count")).toBe("GPIO Count")
  expect(formatHeader("usb_type")).toBe("USB Type")
  expect(formatHeader("adc_channels")).toBe("ADC Channels")
  expect(formatHeader("spi_interfaces")).toBe("SPI Interfaces")
})
