// Local SQLite stand-in for Wrangler. It never makes network requests.
import { Database } from "bun:sqlite"
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs"

const args = process.argv.slice(2)
if (!args.includes("--local") || args.includes("--remote")) {
  throw new Error("The rebuild test double only accepts --local")
}
const sqlFile = args.find((arg) => arg.startsWith("--file="))?.slice(7)
const sql = sqlFile
  ? readFileSync(sqlFile, "utf8")
  : args[args.indexOf("--command") + 1]
appendFileSync(process.env.TEST_SQL_LOG!, `${sql}\n`)
const db = new Database(process.env.TEST_DB!)
const fault = process.env.TEST_FAULT
const isImport = sql.includes("INSERT OR REPLACE INTO search_index_fts")
const marker = `${process.env.TEST_DB}.fault`

if (isImport && fault === "failed_batch" && sql.includes("BETWEEN 3 AND 4")) {
  console.log(JSON.stringify({ error: "injected batch failure" }))
  process.exit(1)
}
if (sql.includes("AS expected_count") && !existsSync(marker)) {
  writeFileSync(marker, "injected")
  if (fault === "missing")
    db.exec("DELETE FROM search_index_fts WHERE rowid=42388007")
  if (fault === "wrong_text")
    db.exec(
      "UPDATE search_index_fts SET search_text='wrong part' WHERE rowid=42388007",
    )
  if (fault === "extra")
    db.exec(
      "INSERT INTO search_index_fts(rowid,search_text) VALUES(9999,'extra part')",
    )
  if (fault === "catalog_changed")
    db.exec(
      "INSERT INTO search_index(rowid,lcsc,search_text) VALUES(100,9000,'new part')",
    )
  if (fault === "bad_json") {
    console.log("not valid JSON")
    process.exit(0)
  }
}

try {
  const results = sqlFile ? (db.exec(sql), []) : db.query(sql).all()
  if (isImport && fault === "lost_reply" && !existsSync(marker)) {
    writeFileSync(marker, "committed")
    console.log(JSON.stringify({ error: "injected lost reply after commit" }))
    process.exit(1)
  }
  console.log(JSON.stringify([{ success: true, results }]))
} finally {
  db.close()
}
