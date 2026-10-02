import { rename, rm } from "node:fs/promises"

await rm("./db.sqlite3", { force: true })
await rename("./cache.sqlite3", "./db.sqlite3")
