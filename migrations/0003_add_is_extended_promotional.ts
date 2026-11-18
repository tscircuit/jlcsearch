/**
 * Migration: Add is_extended_promotional column to components table
 *
 * Some JLCPCB parts are marked as "Extended Promotional", meaning they
 * temporarily act like basic parts (no extra fee) for a limited time.
 * This migration adds a filterable boolean column to capture that state.
 */

import { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("components")
    .addColumn("is_extended_promotional", "integer", (col) =>
      col.notNull().defaultTo(0)
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // SQLite does not support DROP COLUMN in older versions.
  // This is a no-op for safety; remove manually if needed.
}
