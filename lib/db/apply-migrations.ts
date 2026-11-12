import type { Kysely } from "kysely"
import type { Database } from "./schema"

/**
 * Run all pending migrations against the given Kysely database instance.
 * Migrations are applied in order and tracked via a `_migrations` table so
 * each migration runs exactly once.
 */
export async function applyMigrations(db: Kysely<Database>): Promise<void> {
  // Ensure the migrations tracking table exists
  await db.schema
    .createTable("_migrations")
    .ifNotExists()
    .addColumn("name", "text", (col) => col.primaryKey())
    .addColumn("applied_at", "text", (col) => col.notNull())
    .execute()

  // Helper: check whether a named migration has already been applied
  async function hasRun(name: string): Promise<boolean> {
    const row = await db
      .selectFrom("_migrations")
      .select("name")
      .where("name", "=", name)
      .executeTakeFirst()
    return row !== undefined
  }

  // Helper: record a migration as applied
  async function markDone(name: string): Promise<void> {
    await db
      .insertInto("_migrations")
      .values({ name, applied_at: new Date().toISOString() })
      .execute()
  }

  // ── Migration 0001: create components table ──────────────────────────────
  if (!(await hasRun("0001_create_components"))) {
    await db.schema
      .createTable("components")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("lcsc", "integer", (col) => col.notNull().unique())
      .addColumn("mfr", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("package", "text")
      .addColumn("stock", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("price1", "real")
      .addColumn("in_stock", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("is_basic", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("is_preferred", "integer", (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn("extra", "text")
      .addColumn("datasheet_url", "text")
      .addColumn("mfr_img_url", "text")
      .execute()
    await markDone("0001_create_components")
  }

  // ── Migration 0002: add derived numeric columns ──────────────────────────
  if (!(await hasRun("0002_add_derived_columns"))) {
    const cols = [
      "voltage_rating",
      "current_rating",
      "power_rating",
      "resistance",
      "capacitance",
      "inductance",
      "tolerance",
      "frequency",
    ] as const
    for (const col of cols) {
      try {
        await db.schema
          .alterTable("components")
          .addColumn(col, "real")
          .execute()
      } catch {
        // column may already exist in older DBs
      }
    }
    await markDone("0002_add_derived_columns")
  }

  // ── Migration 0003: add is_extended_promotional column ───────────────────
  if (!(await hasRun("0003_add_is_extended_promotional"))) {
    try {
      await db.schema
        .alterTable("components")
        .addColumn("is_extended_promotional", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .execute()
    } catch {
      // column may already exist
    }
    await markDone("0003_add_is_extended_promotional")
  }
}
