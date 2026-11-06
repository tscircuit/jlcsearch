import { expect, test } from "bun:test"
import { gunzipSync } from "node:zlib"
import { encodeCatalog } from "./catalog"

const component = {
  lcsc: 2040,
  mfr: "RP2040",
  package: "QFN-56",
  description: "Microcontroller",
  stock: 100,
  price: 1,
}

test("compresses real search fields, deduplicates IDs and is reproducible", () => {
  const rows = [
    component,
    { ...component, lcsc: 10, raw: "not for distribution" },
    component,
  ]
  const encoded = encodeCatalog(rows, "2026-11-06T00:00:00.000Z")
  expect(encoded).toEqual(encodeCatalog(rows, "2026-11-06T00:00:00.000Z"))
  const decoded = JSON.parse(gunzipSync(encoded).toString())
  expect(decoded.schema_version).toBe(1)
  expect(decoded.coverage).toBe("subset")
  expect(decoded.components.map((row: typeof component) => row.lcsc)).toEqual([
    10, 2040,
  ])
  expect(decoded.components[0].raw).toBeUndefined()
})

test("rejects empty and invalid catalogs instead of inventing supplier data", () => {
  expect(() => encodeCatalog([])).toThrow("empty")
  expect(() => encodeCatalog([{ ...component, lcsc: NaN }])).toThrow("Invalid")
  expect(() => encodeCatalog([{ ...component, stock: -1 }])).toThrow("Invalid")
})
