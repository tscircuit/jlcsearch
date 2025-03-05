import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentSearchFTS: DbOptimizationSpec = {
  name: "components_fts",
  description:
    "FTS5 virtual table for fast component search with case-insensitive and scrambled letter support",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name=${this.name}
    `.execute(db)
    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    // Create FTS5 virtual table with mfr_chars for scrambled letter searching
    await sql`
      CREATE VIRTUAL TABLE components_fts USING fts5(
        mfr,
        description,
        lcsc,
        mfr_chars
      )
    `.execute(db)

    // Create synchronization triggers
    // INSERT trigger: Store fields in lowercase and populate mfr_chars
    await sql`
      CREATE TRIGGER components_ai AFTER INSERT ON components
      BEGIN
        INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
        VALUES (
          new.rowid,
          LOWER(new.mfr),
          LOWER(new.description),
          LOWER(new.lcsc),
          REPLACE(LOWER(new.mfr), '', ' ')
        );
      END
    `.execute(db)

    // UPDATE trigger: Update fields in lowercase and regenerate mfr_chars
    await sql`
      CREATE TRIGGER components_au AFTER UPDATE ON components
      BEGIN
        UPDATE components_fts
        SET 
          mfr = LOWER(new.mfr),
          description = LOWER(new.description),
          lcsc = LOWER(new.lcsc),
          mfr_chars = REPLACE(LOWER(new.mfr), '', ' ')
        WHERE rowid = old.rowid;
      END
    `.execute(db)

    // DELETE trigger: Remove corresponding FTS entry
    await sql`
      CREATE TRIGGER components_ad AFTER DELETE ON components
      BEGIN
        DELETE FROM components_fts WHERE rowid = old.rowid;
      END
    `.execute(db)

    // Populate initial data from components table
    await sql`
      INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
      SELECT 
        rowid,
        LOWER(mfr),
        LOWER(description),
        LOWER(lcsc),
        REPLACE(LOWER(mfr), '', ' ')
      FROM components
    `.execute(db)
  },
}
