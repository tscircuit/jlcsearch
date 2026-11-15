import type { Database } from "bun:sqlite"

/**
 * Create the live stock tables a production database always has, so list
 * queries can look up each part's Standard-only mark.
 */
export const createLiveStockTables = async (database: Database) => {
  for (const migration of ["0017_live_stock.sql", "0023_standard_only.sql"]) {
    database.exec(
      await Bun.file(
        new URL(`../../cf-proxy/migrations/${migration}`, import.meta.url),
      ).text(),
    )
  }
}
