import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentSearchFTS: DbOptimizationSpec = {
  name: "components_fts",
  description: "FTS5 virtual table for fast component search",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name=${this.name}
    `.execute(db)
    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    // Create FTS5 virtual table
    await sql`
      CREATE VIRTUAL TABLE components_fts USING fts5(
        mfr,
        description,
        lcsc
      )
    `.execute(db)

    // Create synchronization triggers
    await sql`
      CREATE TRIGGER components_ai AFTER INSERT ON components
      BEGIN
        INSERT INTO components_fts (rowid, mfr, description, lcsc)
        VALUES (new.rowid, new.mfr, new.description, new.lcsc);
      END
    `.execute(db)

    await sql`
      CREATE TRIGGER components_au AFTER UPDATE ON components
      BEGIN
        UPDATE components_fts
        SET mfr = new.mfr, description = new.description, lcsc = new.lcsc
        WHERE rowid = old.rowid;
      END
    `.execute(db)

    await sql`
      CREATE TRIGGER components_ad AFTER DELETE ON components
      BEGIN
        DELETE FROM components_fts WHERE rowid = old.rowid;
      END
    `.execute(db)

    // Populate initial data
    await sql`
      INSERT INTO components_fts (rowid, mfr, description, lcsc)
      SELECT rowid, mfr, description, lcsc FROM components
    `.execute(db)
  },
}
