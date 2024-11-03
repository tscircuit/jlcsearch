import React from "react"
import { timeAgo } from "./time-ago"

const pluralize = (resource: string) => {
  return resource.endsWith("y") ? `${resource.slice(0, -1)}ies` : `${resource}s`
}

const removeResourcePrefixes = (resource: string) => {
  if (resource.startsWith("creator_")) return resource.slice(8)
  if (resource.startsWith("owner_")) return resource.slice(6)
  if (resource.startsWith("personal_")) return resource.slice(9)
  return resource
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
              <td className="border border-gray-300 p-1">{key}</td>
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
              {key}
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
