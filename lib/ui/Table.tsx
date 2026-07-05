import React from "react"
import { timeAgo } from "./time-ago"

const UNIT_SUFFIX_LABELS: Array<[RegExp, string]> = [
  [/_farads$/, "F"],
  [/_fraction$/, "%"],
  [/_watts$/, "W"],
  [/_hz$/, "Hz"],
  [/_ghz$/, "GHz"],
  [/_bytes$/, "bytes"],
  [/_volt$/, "V"],
  [/_volts$/, "V"],
  [/_amp$/, "A"],
  [/_amps$/, "A"],
  [/_a$/, "A"],
  [/_nm$/, "nm"],
  [/_mcd$/, "mcd"],
  [/_mm$/, "mm"],
]

const COLUMN_LABELS: Record<string, string> = {
  lcsc: "LCSC",
  mfr: "MFR",
  price1: "Price",
  in_stock: "In Stock",
  is_basic: "Basic",
  is_preferred: "Preferred",
  capacitance_farads: "Capacitance (F)",
  tolerance_fraction: "Tolerance (%)",
  voltage_rating: "Voltage",
  current_rating: "Current",
  power_watts: "Power (W)",
  current_rating_a: "Current (A)",
  current_rating_amp: "Current (A)",
  voltage_rating_volt: "Voltage (V)",
  wavelength_nm: "Wavelength (nm)",
  luminous_intensity_mcd: "Intensity (mcd)",
  number_of_contacts: "Contacts",
  num_channels: "Channels",
  num_bits: "Bits",
  num_pins: "Pins",
  num_pins_per_row: "Pins / Row",
  num_rows: "Rows",
  pin_count: "Pins",
  channel_count: "Channels",
  cpu_speed_hz: "CPU Speed (Hz)",
  flash_size_bytes: "Flash (bytes)",
  ram_size_bytes: "RAM (bytes)",
  clock_frequency_hz: "Clock (Hz)",
  frequency_ghz: "Frequency (GHz)",
  pitch_mm: "Pitch (mm)",
}

const titleCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((segment) => {
      const lower = segment.toLowerCase()
      if (["id", "io", "rgb", "usb", "dc", "ac", "bjt"].includes(lower)) {
        return lower.toUpperCase()
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")

export const getColumnLabel = (columnKey: string): string => {
  if (COLUMN_LABELS[columnKey]) return COLUMN_LABELS[columnKey]

  for (const [suffixPattern, unit] of UNIT_SUFFIX_LABELS) {
    if (suffixPattern.test(columnKey)) {
      const baseKey = columnKey.replace(suffixPattern, "")
      return `${titleCase(baseKey)} (${unit})`
    }
  }

  return titleCase(columnKey)
}

const Cell = ({
  row,
  columnKey,
  cellValue,
  timezone,
}: {
  row: any
  columnKey: string
  cellValue: any
  timezone: string
}) => {
  if (!cellValue) return <></>
  if (React.isValidElement(cellValue)) return cellValue
  if (columnKey === "lcsc") {
    return (
      <a href={`https://jlcpcb.com/partdetail/${row.mfr}/C${cellValue}`}>
        {cellValue}
      </a>
    )
  }
  if (columnKey.endsWith("_at")) {
    return <span className="tabular-nums">{timeAgo(cellValue, timezone)}</span>
  }
  return <>{String(cellValue)}</>
}

export const Table = ({
  rows,
  obj,
  timezone,
}: { rows?: object[]; obj?: object; timezone?: string }) => {
  if (!timezone) {
    timezone = "UTC" //globalThis.timezone ?? "UTC"
  }
  if (obj) {
    const entries = Object.entries(obj)
    return (
      <table className="border border-gray-300 text-xs border-collapse p-1 tabular-nums">
        <thead>
          <tr>
            <th className="p-1 border border-gray-300">Key</th>
            <th className="p-1 border border-gray-300">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value], index) => (
            <tr key={index}>
              <td className="border border-gray-300 p-1">
                {getColumnLabel(key)}
              </td>
              <td className="border border-gray-300 p-1">
                <Cell
                  row={obj}
                  columnKey={key}
                  cellValue={value}
                  timezone={timezone!}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (!rows || rows.length === 0) return null

  const keys = Object.keys(rows[0]!)

  return (
    <table className="border border-gray-300 text-xs border-collapse p-1">
      <thead>
        <tr>
          {keys.map((key) => (
            <th key={key} className="p-1 border border-gray-300">
              {getColumnLabel(key)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: any, rowIndex) => (
          <tr key={rowIndex}>
            {keys.map((key) => (
              <td key={key} className="border border-gray-300 p-1">
                <Cell
                  row={row}
                  columnKey={key}
                  cellValue={row[key]}
                  timezone={timezone!}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
