import { expect, test } from "bun:test"
import {
  expireUnverifiedStock,
  unverifiedStockPageSql,
} from "../scripts/expire-unverified-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"
import {
  STOCK_SYNC_TARGETS_QUERY,
  stockSyncTargetsFromSchema,
} from "../scripts/generate-stock-sync-sql"

const noPause = async () => {}

test("zero cleanup pages do not issue even a policy query", async () => {
  let queries = 0
  expect(
    await expireUnverifiedStock(
      async () => {
        queries++
        throw new Error("database unavailable")
      },
      [],
      0,
      noPause,
    ),
  ).toBe(0)
  expect(queries).toBe(0)
})

test("verified pages checkpoint periodically instead of writing on every page", async () => {
  const { db, execute } = await stockDatabase()
  try {
    db.exec(`UPDATE _jlcsearch_stock_policy SET grace_until=0;
      WITH RECURSIVE ids(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM ids WHERE x<12000)
      INSERT INTO component_catalog(lcsc,stock) SELECT x,10 FROM ids;
      INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at)
        SELECT lcsc,stock,unixepoch() FROM component_catalog;`)
    const writes: string[] = []
    expect(
      await expireUnverifiedStock(
        async (sql) => {
          if (/INSERT INTO _jlcsearch_stock_cleanup_progress/.test(sql))
            writes.push(sql)
          return execute(sql)
        },
        [{ name: "component_catalog", has_in_stock: 1 }],
        100,
        noPause,
      ),
    ).toBe(0)
    expect(writes).toHaveLength(2)
    expect(
      db
        .query(
          "SELECT after_lcsc,completed_at FROM _jlcsearch_stock_cleanup_progress",
        )
        .get(),
    ).toEqual({
      after_lcsc: 0,
      completed_at: expect.any(Number),
    })
  } finally {
    db.close()
  }
})

test("cleanup skips unpublished rebuild tables and published tables without an LCSC index", async () => {
  const { db, execute } = await stockDatabase()
  try {
    db.exec(`UPDATE _jlcsearch_stock_policy SET grace_until=0;
      CREATE TABLE search_index_next(lcsc INTEGER, stock INTEGER);
      INSERT INTO search_index_next VALUES(1,123);
      CREATE TABLE resistor(lcsc INTEGER, stock INTEGER);
      INSERT INTO resistor VALUES(1,456);`)
    const targets = stockSyncTargetsFromSchema(
      db
        .query<{ name: string; sql: string }, []>(STOCK_SYNC_TARGETS_QUERY)
        .all(),
    )
    expect(targets.some((t) => t.name === "search_index_next")).toBe(true)
    const plan = db
      .query(
        `EXPLAIN QUERY PLAN ${unverifiedStockPageSql("search_index_next", 0)}`,
      )
      .all() as { detail: string }[]
    expect(plan.some((r) => r.detail === "SCAN search_index_next")).toBe(true)
    const queries: string[] = []
    await expireUnverifiedStock(
      async (sql) => {
        queries.push(sql)
        return execute(sql)
      },
      targets,
      100,
      noPause,
    )
    expect(db.query("SELECT stock FROM search_index_next").get()).toEqual({
      stock: 123,
    })
    expect(db.query("SELECT stock FROM resistor").get()).toEqual({ stock: 456 })
    expect(queries.some((sql) => sql.includes('UPDATE "resistor"'))).toBe(false)
    // A staging table stays excluded even if its index is created later.
    db.exec("CREATE INDEX idx_next_lcsc ON search_index_next(lcsc)")
    await expireUnverifiedStock(execute, targets, 100, noPause)
    expect(db.query("SELECT stock FROM search_index_next").get()).toEqual({
      stock: 123,
    })
  } finally {
    db.close()
  }
})

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

test("invalid or duplicate catalog IDs cannot be written into cleanup SQL or advance progress", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    for (const ids of [
      ["1); DROP TABLE component_catalog;"],
      [1, 1],
      [2, 1],
      [Number.MAX_SAFE_INTEGER + 1],
    ]) {
      await expect(
        expireUnverifiedStock(
          async (sql) => {
            if (sql.startsWith("SELECT c.lcsc"))
              return ids.map((lcsc) => ({ lcsc, stock: 10, verified: 0 }))
            if (sql.startsWith("UPDATE") || sql.startsWith("INSERT"))
              throw new Error("Unexpected write")
            return execute(sql)
          },
          targets,
          1,
          noPause,
        ),
      ).rejects.toThrow("Invalid or unordered cleanup LCSC")
    }
    expect(
      db
        .query("SELECT count(*) AS n FROM _jlcsearch_stock_cleanup_progress")
        .get(),
    ).toEqual({ n: 0 })
  } finally {
    db.close()
  }
})

test("an interrupted checkpoint interval safely replays unsaved pages", async () => {
  const { db, execute } = await stockDatabase()
  try {
    db.exec(`UPDATE _jlcsearch_stock_policy SET grace_until=0;
      WITH RECURSIVE ids(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM ids WHERE x<12000)
      INSERT INTO component_catalog(lcsc,stock) SELECT x,10 FROM ids;`)
    const targets = [{ name: "component_catalog", has_in_stock: 1 }]
    let reads = 0
    await expect(
      expireUnverifiedStock(
        async (sql) => {
          if (sql.startsWith("SELECT c.lcsc") && ++reads === 12)
            throw new Error("interrupted")
          return execute(sql)
        },
        targets,
        100,
        noPause,
      ),
    ).rejects.toThrow("interrupted")
    expect(
      db
        .query("SELECT after_lcsc FROM _jlcsearch_stock_cleanup_progress")
        .get(),
    ).toEqual({ after_lcsc: 10000 })
    const resumed: string[] = []
    await expireUnverifiedStock(
      async (sql) => {
        resumed.push(sql)
        return execute(sql)
      },
      targets,
      100,
      noPause,
    )
    expect(resumed.find((sql) => sql.startsWith("SELECT c.lcsc"))).toContain(
      "lcsc > 10000",
    )
    expect(
      db
        .query(
          "SELECT count(*) AS n FROM component_catalog WHERE stock IS NOT NULL",
        )
        .get(),
    ).toEqual({ n: 0 })
  } finally {
    db.close()
  }
})

test("stock write batches stay small and a later batch failure cannot skip work", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    for (const name of ["resistor", "capacitor", "diode", "led", "adc"]) {
      db.exec(`CREATE TABLE "${name}"(lcsc INTEGER PRIMARY KEY,stock INTEGER)`)
      targets.push({ name, has_in_stock: 0 })
    }
    db.transaction(() => {
      for (const t of targets) {
        const insert = db.query(
          `INSERT INTO "${t.name}"(lcsc,stock) VALUES(?,10)`,
        )
        for (let i = 0; i < 1000; i++) insert.run(8_000_000_000_000_000 + i)
      }
    })()
    let batches = 0
    await expect(
      expireUnverifiedStock(
        async (sql) => {
          if (sql.startsWith("UPDATE")) {
            expect(new TextEncoder().encode(sql).length).toBeLessThan(100000)
            expect(sql.match(/UPDATE "/g)?.length).toBeLessThanOrEqual(4)
            if (++batches === 2) throw new Error("second batch failed")
          }
          return execute(sql)
        },
        targets,
        1,
        noPause,
      ),
    ).rejects.toThrow("second batch failed")
    expect(
      db
        .query("SELECT count(*) AS n FROM _jlcsearch_stock_cleanup_progress")
        .get(),
    ).toEqual({ n: 0 })
    // Finish the interrupted pass without discarding stock left in other tables.
    await expireUnverifiedStock(execute, targets, 100, noPause)
    for (const t of targets)
      expect(
        db
          .query(
            `SELECT count(*) AS n FROM "${t.name}" WHERE stock IS NOT NULL`,
          )
          .get(),
      ).toEqual({ n: 0 })
  } finally {
    db.close()
  }
})
