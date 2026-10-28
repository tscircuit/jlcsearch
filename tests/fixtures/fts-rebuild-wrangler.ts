import { Database } from "bun:sqlite"
import { appendFileSync } from "node:fs"

// Local substitute for Wrangler: execute the script's SQL without contacting D1.
const databasePath = process.env.TEST_FTS_DATABASE
const commandLog = process.env.TEST_FTS_COMMAND_LOG
if (!databasePath || !commandLog)
  throw new Error("Missing test database or log")

const args = process.argv.slice(2)
if (args.slice(0, 3).join(" ") !== "wrangler d1 execute") {
  throw new Error(`Unexpected Wrangler invocation: ${args.join(" ")}`)
}
const file = args.find((arg) => arg.startsWith("--file="))?.slice(7)
const commandIndex = args.indexOf("--command")
const sql = file
  ? await Bun.file(file).text()
  : commandIndex >= 0
    ? args[commandIndex + 1]
    : undefined
if (!sql) throw new Error("Missing SQL")
appendFileSync(commandLog, `${JSON.stringify(sql)}\n`)

const batchStart = sql.match(/WHERE rowid BETWEEN (\d+) AND/)?.[1]
if (batchStart === process.env.TEST_FTS_FAIL_BATCH) {
  console.error("Simulated D1 batch failure")
  process.exit(23)
}

const db = new Database(databasePath)
try {
  db.exec(sql)
} finally {
  db.close()
}
