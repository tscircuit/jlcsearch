import { readFileSync } from "node:fs"

const validateSqlIdentifier = (identifier: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`)
  }
  return identifier
}

const quoteIdentifier = (identifier: string) =>
  `"${validateSqlIdentifier(identifier)}"`

const integerLiteral = (value: number, label: string) => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer, received ${value}`)
  }
  return String(value)
}

const createLcscValues = (lcscs: number[]) => {
  if (lcscs.length === 0) {
    throw new Error("Cannot create stock propagation SQL for an empty LCSC set")
  }

  const seen = new Set<number>()
  for (const lcsc of lcscs) {
    if (seen.has(lcsc)) {
      throw new Error(`Duplicate LCSC in stock propagation batch: ${lcsc}`)
    }
    seen.add(lcsc)
  }

  return lcscs.map((lcsc) => `(${integerLiteral(lcsc, "lcsc")})`).join(",")
}

const readLcscBatchFile = (filePath: string) => {
  const values = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!/^[0-9]+$/.test(line)) {
        throw new Error(`Invalid LCSC in stock propagation batch: ${line}`)
      }
      const lcsc = Number.parseInt(line, 10)
      integerLiteral(lcsc, "lcsc")
      return lcsc
    })

  createLcscValues(values)
  return values
}

export const createSearchIndexPropagationSql = (lcscs: number[]) =>
  `
WITH component_updates(lcsc) AS (VALUES ${createLcscValues(lcscs)})
UPDATE search_index AS target
SET stock = source.stock,
    basic = source.basic,
    preferred = source.preferred,
    is_extended_promotional = source.is_extended_promotional
FROM component_catalog AS source
JOIN component_updates ON component_updates.lcsc = source.lcsc
WHERE target.lcsc = source.lcsc
  AND (
    target.stock IS NOT source.stock
    OR target.basic IS NOT source.basic
    OR target.preferred IS NOT source.preferred
    OR target.is_extended_promotional IS NOT source.is_extended_promotional
  );
`.trim()

export const createDerivedTablePropagationSql = (
  tableName: string,
  lcscs: number[],
) => {
  const table = quoteIdentifier(tableName)

  return `
WITH component_updates(lcsc) AS (VALUES ${createLcscValues(lcscs)})
UPDATE ${table} AS target
SET stock = COALESCE(source.stock, 0),
    in_stock = CASE
      WHEN COALESCE(source.stock, 0) > 0 THEN 1
      ELSE 0
    END,
    is_basic = COALESCE(source.basic, 0),
    is_preferred = COALESCE(source.preferred, 0),
    is_extended_promotional = COALESCE(source.is_extended_promotional, 0)
FROM component_catalog AS source
JOIN component_updates ON component_updates.lcsc = source.lcsc
WHERE target.lcsc = source.lcsc
  AND (
    target.stock IS NOT COALESCE(source.stock, 0)
    OR target.in_stock IS NOT CASE
      WHEN COALESCE(source.stock, 0) > 0 THEN 1
      ELSE 0
    END
    OR target.is_basic IS NOT COALESCE(source.basic, 0)
    OR target.is_preferred IS NOT COALESCE(source.preferred, 0)
    OR target.is_extended_promotional IS NOT COALESCE(source.is_extended_promotional, 0)
  );
`.trim()
}

if (import.meta.main) {
  const [kind, tableNameOrLcscFile, lcscFile] = Bun.argv.slice(2)
  if (kind === "search_index" && tableNameOrLcscFile) {
    console.log(
      createSearchIndexPropagationSql(readLcscBatchFile(tableNameOrLcscFile)),
    )
  } else if (kind === "derived" && tableNameOrLcscFile && lcscFile) {
    console.log(
      createDerivedTablePropagationSql(
        tableNameOrLcscFile,
        readLcscBatchFile(lcscFile),
      ),
    )
  } else {
    throw new Error(
      "Usage: bun run scripts/stock-sync-propagation-sql.ts search_index <lcsc-file> | derived <table> <lcsc-file>",
    )
  }
}
