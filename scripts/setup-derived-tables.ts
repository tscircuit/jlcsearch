import { destroyDbClient } from "lib/db/get-db-client"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const resetArg = process.argv.indexOf("--reset")
const resetTable = resetArg !== -1 ? process.argv[resetArg + 1] : null
const resetAll = resetArg !== -1 && !resetTable

async function main() {
  try {
    await setupDerivedTables({
      resetAll,
      resetTable,
      logger: console.log,
    })
  } finally {
    await destroyDbClient()
  }
}

main().catch(console.error)
