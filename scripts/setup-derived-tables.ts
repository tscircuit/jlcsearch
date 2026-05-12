import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const resetArg = process.argv.indexOf("--reset")
const resetTable = resetArg !== -1 ? process.argv[resetArg + 1] : null
const resetAll = resetArg !== -1 && !resetTable
const populate = process.env.JLCSEARCH_SKIP_DERIVED_TABLE_POPULATE !== "true"

async function main() {
  if (!populate) {
    console.log(
      "Skipping derived table population because JLCSEARCH_SKIP_DERIVED_TABLE_POPULATE is true",
    )
  }

  await setupDerivedTables({
    populate,
    resetAll,
    resetTable,
    logger: console.log,
  })
}

main().catch(console.error)
