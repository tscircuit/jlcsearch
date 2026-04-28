export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from extended_promotional = 'true'",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (
        LOWER(extended_promotional) = 'true'
      )
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}