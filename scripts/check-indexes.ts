import Database from "bun:sqlite"
const db = new Database("db.sqlite3")

console.log(
  "v_components def:",
  db.prepare("SELECT sql FROM sqlite_master WHERE name='v_components'").get(),
)
console.log(
  "categories indexes:",
  db.prepare("PRAGMA index_list(categories)").all(),
)

// Check if subcategory column exists in categories
console.log(
  "categories columns:",
  db.prepare("PRAGMA table_info(categories)").all(),
)

// Check how long the microphones query takes
const start = Date.now()
const result = db
  .prepare(
    "SELECT count(*) as count FROM v_components WHERE subcategory IN ('Microphones', 'MEMS Microphones') AND stock > 0",
  )
  .get()
console.log("Microphone query took:", Date.now() - start, "ms, result:", result)

// Check if subcategory index exists on categories
console.log("Creating subcategory index...")
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_categories_subcategory ON categories (subcategory)",
)
console.log("Done")

const start2 = Date.now()
const result2 = db
  .prepare(
    "SELECT count(*) as count FROM v_components WHERE subcategory IN ('Microphones', 'MEMS Microphones') AND stock > 0",
  )
  .get()
console.log(
  "Microphone query after index took:",
  Date.now() - start2,
  "ms, result:",
  result2,
)
