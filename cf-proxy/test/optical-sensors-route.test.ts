import { describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"

describe("Optical Sensors route", () => {
  const opticalSensor = {
    lcsc: 20612443,
    mfr: "PMW3360DM-T2QU",
    package: "DIP-16",
    sensor_type: "Optical Motion",
    stock: 0,
    price1: 2.4,
    in_stock: 0,
    is_basic: 0,
    is_preferred: 1,
    attributes: "{}",
  }
  const optionFields = ["package", "sensor_type"] as const
  it("serves the filtered HTML page and JSON API through the worker", async () => {
    const env = createTestEnv()
    const self = createSelf(env)
    const partsQueries: Array<{ sql: string; parameters: unknown[] }> = []
    env.USE_D1 = "true"
    env.DB = {
      prepare: (sql: string) => ({
        bind: (...parameters: unknown[]) => ({
          all: async () => {
            const optionField = optionFields.find((field) =>
              sql.includes(`CAST("${field}" AS TEXT) AS value`),
            )
            if (sql.startsWith('SELECT * FROM "optical_sensor"')) {
              partsQueries.push({ sql, parameters })
            }
            return {
              results: optionField
                ? [{ value: String(opticalSensor[optionField]) }]
                : [opticalSensor],
              meta: { changes: 0 },
            }
          },
        }),
      }),
    } as unknown as D1Database

    try {
      const response = await self.fetch(
        "https://example.com/optical_sensors/list?package=DIP-16&sensor_type=Optical%20Motion&in_stock=false&is_basic=false&is_preferred=true",
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(response.headers.get("x-data-source")).toBe("d1")
      const html = await response.text()
      expect(html).toContain("<h2>Optical Sensors</h2>")
      expect(html).toContain('name="package" value="DIP-16"')
      expect(html).toContain("PMW3360DM-T2QU")
      expect(html).toContain('name="sensor_type" value="Optical Motion"')
      expect(html).toContain(
        "motion/navigation sensors for mice and trackballs",
      )
      expect(html).toContain(
        "Out-of-stock catalog parts are included with stock 0.",
      )
      expect(html).toContain(
        "/optical_sensors/list.json?package=DIP-16&amp;sensor_type=Optical+Motion&amp;in_stock=false&amp;is_basic=false&amp;is_preferred=true",
      )

      const jsonResponse = await self.fetch(
        "https://example.com/optical_sensors/list.json?package=DIP-16&sensor_type=Optical%20Motion&in_stock=false&is_basic=false&is_preferred=true",
      )

      expect(jsonResponse.status).toBe(200)
      expect(jsonResponse.headers.get("content-type")).toContain(
        "application/json",
      )
      expect(jsonResponse.headers.get("x-data-source")).toBe("d1")
      expect(await jsonResponse.json()).toEqual({
        optical_sensors: [
          {
            ...opticalSensor,
            in_stock: false,
            is_basic: false,
            is_preferred: true,
          },
        ],
      })
      expect(partsQueries).toHaveLength(2)
      for (const query of partsQueries) {
        expect(query.sql).toContain(
          'WHERE "package" = ? AND "sensor_type" = ? AND "in_stock" = ? AND "is_basic" = ? AND "is_preferred" = ?',
        )
        expect(query.parameters).toEqual(["DIP-16", "Optical Motion", 0, 0, 1])
      }
    } finally {
      await self.flushWaitUntil()
    }
  })
})
