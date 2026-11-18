import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("components")
    .addColumn("is_extended_promotional", "integer", (col) =>
      col.defaultTo(0).notNull(),
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("components")
    .dropColumn("is_extended_promotional")
    .execute()
}
