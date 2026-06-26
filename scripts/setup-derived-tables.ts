import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { getDbClient } from "lib/db/get-db-client"

const resetArg = process.argv.indexOf("--reset")
const resetTable = resetArg !== -1 ? process.argv[resetArg + 1] : null
const resetAll = resetArg !== -1 && !resetTable

async function main() {
  await setupDerivedTables({
    resetAll,
    resetTable,
    logger: console.log,
  })
  await getDbClient().destroy()
}

main().catch(console.error)
