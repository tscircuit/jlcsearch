import Database from "better-sqlite3"
import Path from "node:path"

const DB_PATH = Path.join(import.meta.dirname || "", "../db.sqlite3")

async function main() {
  const db = new Database(DB_PATH)
  
  // Find category IDs
  const categories = db.prepare(`SELECT id, subcategory FROM categories WHERE subcategory IN ('Microphones', 'MEMS Microphones')`).all()
  console.log("Categories found:", categories)
  const ids = categories.map((c: any) => c.id)
  
  if (ids.length === 0) {
    console.log("No categories found.")
    db.close()
    return
  }

  // Count components
  const count = db.prepare(`SELECT COUNT(*) as count FROM components WHERE category_id IN (${ids.join(',')})`).get() as any
  console.log("Total components in category:", count.count)

  // Explain packages query
  const query = `SELECT DISTINCT package FROM components WHERE category_id IN (${ids.join(',')}) AND package IS NOT NULL ORDER BY package`
  const explain = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all()
  console.log("\nQuery plan for packages query:")
  console.log(JSON.stringify(explain, null, 2))

  // Run packages query and measure time
  const start = Date.now()
  const packages = db.prepare(query).all()
  console.log(`\nPackages found (${packages.length}):`, packages.map((p: any) => p.package).slice(0, 10))
  console.log(`Query took: ${Date.now() - start}ms`)

  // Explain main query
  const mainQuery = `SELECT lcsc, mfr, package, description, stock, price, subcategory FROM v_components WHERE stock > 0 AND subcategory IN ('Microphones', 'MEMS Microphones') ORDER BY stock DESC LIMIT 100`
  const explainMain = db.prepare(`EXPLAIN QUERY PLAN ${mainQuery}`).all()
  console.log("\nQuery plan for main query:")
  console.log(JSON.stringify(explainMain, null, 2))

  const startMain = Date.now()
  const mainResult = db.prepare(mainQuery).all()
  console.log(`Main query took: ${Date.now() - startMain}ms`)

  db.close()
}

main().catch(console.error)
