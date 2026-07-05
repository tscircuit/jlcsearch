import { Database } from "bun:sqlite"
const db = new Database(".buildtmp/cache.sqlite3")
console.log(
  db.query("SELECT sql FROM sqlite_master WHERE name='v_components';").all(),
)
