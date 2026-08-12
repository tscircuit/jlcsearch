import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import {
  COPPER_IOU_THRESHOLD,
  buildFootprinterStringUpsert,
  createFootprinterStringRow,
  isPermanentEasyEdaMiss,
} from "../lib/footprinter-strings"

describe("isPermanentEasyEdaMiss", () => {
  test.each([
    "Component not found",
    'No exact EasyEDA component match for "C123"',
    "Failed to fetch the component details (HTTP 404)",
  ])("recognizes a definitive source miss: %s", (message) => {
    expect(isPermanentEasyEdaMiss(new Error(message))).toBe(true)
  })

  test.each([
    'EasyEDA API rate limit exceeded while searching for "C123" (HTTP 403)',
    "Failed to search for the component (HTTP 500)",
    "The operation timed out",
    "Wrangler exited with code 1",
  ])("keeps a transient failure retryable: %s", (message) => {
    expect(isPermanentEasyEdaMiss(new Error(message))).toBe(false)
  })
})

describe("createFootprinterStringRow", () => {
  test("keeps strings strictly above the copper IoU threshold", () => {
    expect(
      createFootprinterStringRow(123, {
        footprinterString: "soic8",
        copperIntersectionOverUnion: COPPER_IOU_THRESHOLD + 0.0001,
      }),
    ).toEqual({
      lcsc: 123,
      footprinterString: "soic8",
      copperIou: COPPER_IOU_THRESHOLD + 0.0001,
    })
  })

  test("stores a nullable string at or below the threshold", () => {
    expect(
      createFootprinterStringRow(456, {
        footprinterString: "qfn16",
        copperIntersectionOverUnion: COPPER_IOU_THRESHOLD,
      }),
    ).toEqual({
      lcsc: 456,
      footprinterString: null,
      copperIou: COPPER_IOU_THRESHOLD,
    })
  })

  test("allows a fully null discovery result", () => {
    expect(createFootprinterStringRow(789, null)).toEqual({
      lcsc: 789,
      footprinterString: null,
      copperIou: null,
    })
  })
})

test("buildFootprinterStringUpsert escapes strings and preserves nulls", () => {
  const sql = buildFootprinterStringUpsert([
    { lcsc: 123, footprinterString: "pinrow4_note('x')", copperIou: 0.99 },
    { lcsc: 456, footprinterString: null, copperIou: null },
  ])

  expect(sql).toContain("pinrow4_note(''x'')")
  expect(sql).toContain("(456, NULL, NULL, CURRENT_TIMESTAMP)")
  expect(sql).toContain("ON CONFLICT(lcsc) DO UPDATE")
})

test("D1 migration allows null matches and enforces the IoU threshold", async () => {
  const database = new Database(":memory:")
  const migrationPath = new URL(
    "../cf-proxy/migrations/0004_footprinter_strings.sql",
    import.meta.url,
  )
  const migration = await Bun.file(migrationPath).text()

  try {
    database.exec(migration)
    database.exec(migration)
    database.exec(
      "INSERT INTO footprinter_strings (lcsc, footprinter_string, copper_iou) VALUES (1, NULL, NULL)",
    )
    database.exec(
      "INSERT INTO footprinter_strings (lcsc, footprinter_string, copper_iou) VALUES (2, 'soic8', 0.951)",
    )

    expect(() =>
      database.exec(
        "INSERT INTO footprinter_strings (lcsc, footprinter_string, copper_iou) VALUES (3, 'qfn16', 0.95)",
      ),
    ).toThrow()
    expect(
      database.query("SELECT COUNT(*) AS count FROM footprinter_strings").get(),
    ).toEqual({ count: 2 })
  } finally {
    database.close()
  }
})
