/**
 * Sets up the SQLite database schema. Creates tables if they do not exist
 * and applies any pending column additions needed for existing databases.
 */

import type { Kysely } from "kysely"

export async function setupDb(db: Kysely<any>): Promise<void> {
  // Create categories table
  await db.schema
    .createTable("categories")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("category", "text", (col) => col.notNull())
    .addColumn("subcategory", "text", (col) => col.notNull())
    .addColumn("component_count", "integer")
    .execute()

  // Create components table with all columns including is_extended_promotional
  await db.schema
    .createTable("components")
    .ifNotExists()
    .addColumn("lcsc", "integer", (col) => col.primaryKey().notNull())
    .addColumn("category_id", "integer", (col) => col.notNull())
    .addColumn("mfr", "text", (col) => col.notNull())
    .addColumn("package", "text", (col) => col.notNull())
    .addColumn("joints", "integer", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("stock", "integer", (col) => col.notNull())
    .addColumn("price", "real")
    .addColumn("last_update", "text", (col) => col.notNull())
    .addColumn("extra", "text")
    .addColumn("in_stock", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_basic", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_preferred", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_extended_promotional", "integer", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("images", "text")
    .addColumn("datasheet", "text")
    .execute()

  // For existing databases that don't yet have is_extended_promotional,
  // attempt to add the column (will fail silently if already present).
  try {
    await db.schema
      .alterTable("components")
      .addColumn("is_extended_promotional", "integer", (col) =>
        col.notNull().defaultTo(0)
      )
      .execute()
    console.log("Added is_extended_promotional column to components table")
  } catch {
    // Column already exists — nothing to do
  }
}
