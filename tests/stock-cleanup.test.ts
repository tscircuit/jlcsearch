import { expect, test } from "bun:test"
import {
  expireUnverifiedStock,
  unverifiedStockPageSql,
} from "../scripts/expire-unverified-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

const noPause = async () => {}

test("empty match pages consume budget and resume past verified and null-stock rows", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    db.transaction(() => {
      for (let id = 1; id <= 1001; id++) insertPart(db, id)
      db.exec(`INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at)
        SELECT lcsc,stock,unixepoch() FROM component_catalog WHERE lcsc<=500;
        UPDATE component_catalog SET stock=NULL WHERE lcsc>500 AND lcsc<=1000;`)
    })()
    const queries: string[] = []
    let pauses = 0
    const run = () =>
      expireUnverifiedStock(
        async (sql) => {
          queries.push(sql)
          return execute(sql)
        },
        targets,
        1,
        async () => {
          pauses++
        },
      )
    expect(await run()).toBe(0)
    expect(
      db
        .query(
          "SELECT after_lcsc FROM _jlcsearch_stock_cleanup_progress WHERE target='component_catalog'",
        )
        .get(),
    ).toEqual({ after_lcsc: 1000 })
    expect(
      db.query("SELECT stock FROM component_catalog WHERE lcsc=1001").get(),
    ).toEqual({ stock: 2184 })
    expect(await run()).toBe(1)
    expect(db.query("SELECT stock FROM switch WHERE lcsc=1001").get()).toEqual({
      stock: null,
    })
    expect(
      queries.filter((sql) => sql.includes("FROM (SELECT lcsc, stock")),
    ).toHaveLength(2)
    expect(pauses).toBe(2)
    // A completed catalog yields priority to the next unfinished table.
    queries.length = 0
    await run()
    expect(
      queries.some((sql) => sql.includes('FROM "search_index" WHERE lcsc > 0')),
    ).toBe(true)
  } finally {
    db.close()
  }
})

test("a fresh observation arriving after selection is preserved in every table", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    let refreshed = false
    await expireUnverifiedStock(
      async (sql) => {
        if (!refreshed && sql.includes('UPDATE "component_catalog"')) {
          refreshed = true
          db.exec(
            "INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at) VALUES(1,999,unixepoch())",
          )
          for (const target of targets)
            db.exec(`UPDATE "${target.name}" SET stock=999`)
        }
        return execute(sql)
      },
      targets,
      1,
      noPause,
    )
    for (const target of targets)
      expect(
        db.query(`SELECT stock FROM "${target.name}" WHERE lcsc=1`).get(),
      ).toEqual({ stock: 999 })
  } finally {
    db.close()
  }
})

test("failed updates do not advance the cursor and a rerun repairs partial work", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    insertPart(db, 2)
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    await expect(
      expireUnverifiedStock(
        async (sql) => {
          if (sql.includes('UPDATE "component_catalog"')) {
            db.exec(
              "UPDATE component_catalog SET stock=NULL,in_stock=0 WHERE lcsc=1",
            )
            throw new Error("injected partial failure")
          }
          return execute(sql)
        },
        targets,
        100,
        noPause,
      ),
    ).rejects.toThrow("injected partial failure")
    expect(
      db.query("SELECT * FROM _jlcsearch_stock_cleanup_progress").all(),
    ).toEqual([])
    await expireUnverifiedStock(execute, targets, 100, noPause)
    for (const target of targets)
      expect(
        db.query(`SELECT stock,in_stock FROM "${target.name}"`).all(),
      ).toEqual([
        { stock: null, in_stock: 0 },
        { stock: null, in_stock: 0 },
      ])
  } finally {
    db.close()
  }
})

test("completed passes revisit newly imported rows below the previous cursor", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 100)
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    await expireUnverifiedStock(execute, targets, 100, noPause)
    insertPart(db, 1)
    await expireUnverifiedStock(execute, targets, 100, noPause)
    expect(
      db.query("SELECT stock FROM component_catalog WHERE lcsc=1").get(),
    ).toEqual({ stock: null })
  } finally {
    db.close()
  }
})

test("the candidate query uses the LCSC index and bounds a page before checking observations", async () => {
  const { db } = await stockDatabase()
  try {
    const plan = db
      .query(
        unverifiedStockPageSql("component_catalog", 10).replace(
          /^SELECT/,
          "EXPLAIN QUERY PLAN SELECT",
        ),
      )
      .all() as { detail: string }[]
    expect(
      plan.some((row) =>
        /SEARCH component_catalog USING INTEGER PRIMARY KEY/.test(row.detail),
      ),
    ).toBe(true)
    expect(plan.some((row) => row.detail === "SCAN component_catalog")).toBe(
      false,
    )
    // Stock predicates must be outside the candidate window: otherwise a
    // mostly-NULL catalog can still scan millions of entries for 1000 matches.
    db.exec(`WITH RECURSIVE ids(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM ids WHERE x<2500)
      INSERT INTO component_catalog(lcsc,stock) SELECT x,NULL FROM ids`)
    const rows = db
      .query(unverifiedStockPageSql("component_catalog", 10))
      .all() as { lcsc: number }[]
    expect(rows).toHaveLength(1000)
    expect(rows.at(-1)?.lcsc).toBe(1010)
  } finally {
    db.close()
  }
})

test("rejects invalid identifiers, cursors and budgets before issuing unsafe SQL", async () => {
  expect(() => unverifiedStockPageSql('part";DROP TABLE part', 0)).toThrow()
  expect(() => unverifiedStockPageSql("part", -1)).toThrow()
  const queries: string[] = []
  await expect(
    expireUnverifiedStock(
      async (sql) => {
        queries.push(sql)
        return []
      },
      [],
      -1,
      noPause,
    ),
  ).rejects.toThrow()
  expect(queries).toEqual([])
})
