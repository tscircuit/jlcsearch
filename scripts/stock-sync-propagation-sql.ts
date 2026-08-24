const validateSqlIdentifier = (identifier: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`)
  }
  return identifier
}

const quoteIdentifier = (identifier: string) =>
  `"${validateSqlIdentifier(identifier)}"`

export const createSearchIndexPropagationSql = () =>
  `
UPDATE search_index AS target
SET stock = (SELECT source.stock FROM component_catalog AS source WHERE source.lcsc = target.lcsc),
    basic = (SELECT source.basic FROM component_catalog AS source WHERE source.lcsc = target.lcsc),
    preferred = (SELECT source.preferred FROM component_catalog AS source WHERE source.lcsc = target.lcsc),
    is_extended_promotional = (SELECT source.is_extended_promotional FROM component_catalog AS source WHERE source.lcsc = target.lcsc)
WHERE EXISTS (
  SELECT 1 FROM component_catalog AS source WHERE source.lcsc = target.lcsc
)
  AND (
    target.stock IS NOT (SELECT source.stock FROM component_catalog AS source WHERE source.lcsc = target.lcsc)
    OR target.basic IS NOT (SELECT source.basic FROM component_catalog AS source WHERE source.lcsc = target.lcsc)
    OR target.preferred IS NOT (SELECT source.preferred FROM component_catalog AS source WHERE source.lcsc = target.lcsc)
    OR target.is_extended_promotional IS NOT (SELECT source.is_extended_promotional FROM component_catalog AS source WHERE source.lcsc = target.lcsc)
  );
`.trim()

export const createDerivedTablePropagationSql = (tableName: string) => {
  const table = quoteIdentifier(tableName)

  return `
UPDATE ${table} AS target
SET stock = COALESCE((SELECT source.stock FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0),
    in_stock = CASE
      WHEN COALESCE((SELECT source.stock FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0) > 0 THEN 1
      ELSE 0
    END,
    is_basic = COALESCE((SELECT source.basic FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0),
    is_preferred = COALESCE((SELECT source.preferred FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0),
    is_extended_promotional = COALESCE((SELECT source.is_extended_promotional FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0)
WHERE EXISTS (
  SELECT 1 FROM component_catalog AS source WHERE source.lcsc = target.lcsc
)
  AND (
    target.stock IS NOT COALESCE((SELECT source.stock FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0)
    OR target.in_stock IS NOT CASE
      WHEN COALESCE((SELECT source.stock FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0) > 0 THEN 1
      ELSE 0
    END
    OR target.is_basic IS NOT COALESCE((SELECT source.basic FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0)
    OR target.is_preferred IS NOT COALESCE((SELECT source.preferred FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0)
    OR target.is_extended_promotional IS NOT COALESCE((SELECT source.is_extended_promotional FROM component_catalog AS source WHERE source.lcsc = target.lcsc), 0)
  );
`.trim()
}

if (import.meta.main) {
  const [kind, tableName] = Bun.argv.slice(2)
  if (kind === "search_index") {
    console.log(createSearchIndexPropagationSql())
  } else if (kind === "derived" && tableName) {
    console.log(createDerivedTablePropagationSql(tableName))
  } else {
    throw new Error(
      "Usage: bun run scripts/stock-sync-propagation-sql.ts search_index | derived <table>",
    )
  }
}
