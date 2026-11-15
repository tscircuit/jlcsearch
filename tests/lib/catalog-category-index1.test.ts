import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  CATEGORY_INDEX,
  catalogSchemaFromSyncScript,
  indexDefinitions,
  readRepoFile,
} from "../fixtures/catalog-category-index"

test("the category index migration matches what a catalog sync creates", async () => {
  const schema = await catalogSchemaFromSyncScript()
  const synced = new Database(":memory:")
  const migrated = new Database(":memory:")
  synced.exec(schema)
  // Production's catalog predates the index.
  migrated.exec(
    schema
      .split("\n")
      .filter((line) => !line.includes(CATEGORY_INDEX))
      .join("\n"),
  )
  expect(indexDefinitions(migrated)).not.toEqual(indexDefinitions(synced))

  const migration = await readRepoFile(
    "cf-proxy/migrations/0026_component_catalog_category_index.sql",
  )
  migrated.exec(migration)
  // Applying the migration twice must be harmless after a lost response.
  migrated.exec(migration)
  expect(indexDefinitions(migrated)).toEqual(indexDefinitions(synced))
})
