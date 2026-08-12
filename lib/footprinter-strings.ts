export const COPPER_IOU_THRESHOLD = 0.95

export interface FootprinterCandidate {
  copperIntersectionOverUnion: number
  footprinterString: string
}

export interface FootprinterStringRow {
  copperIou: number | null
  footprinterString: string | null
  lcsc: number
}

const PERMANENT_EASYEDA_MISS_MESSAGES = [
  "Component not found",
  "Failed to fetch the component details (HTTP 404)",
]

export const isPermanentEasyEdaMiss = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)

  return (
    PERMANENT_EASYEDA_MISS_MESSAGES.includes(message) ||
    message.startsWith('No exact EasyEDA component match for "')
  )
}

export const createFootprinterStringRow = (
  lcsc: number,
  candidate: FootprinterCandidate | null | undefined,
): FootprinterStringRow => {
  const copperIou = candidate?.copperIntersectionOverUnion ?? null

  return {
    lcsc,
    footprinterString:
      copperIou !== null && copperIou > COPPER_IOU_THRESHOLD
        ? candidate!.footprinterString
        : null,
    copperIou,
  }
}

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`

export const buildFootprinterStringUpsert = (
  rows: readonly FootprinterStringRow[],
): string => {
  if (rows.length === 0) {
    throw new Error("Cannot build a footprinter_strings upsert without rows")
  }

  const values = rows
    .map(
      (row) =>
        `(${row.lcsc}, ${row.footprinterString === null ? "NULL" : sqlString(row.footprinterString)}, ${row.copperIou ?? "NULL"}, CURRENT_TIMESTAMP)`,
    )
    .join(",\n  ")

  return `INSERT INTO footprinter_strings (
  lcsc,
  footprinter_string,
  copper_iou,
  updated_at
) VALUES
  ${values}
ON CONFLICT(lcsc) DO UPDATE SET
  footprinter_string = excluded.footprinter_string,
  copper_iou = excluded.copper_iou,
  updated_at = CURRENT_TIMESTAMP;`
}
