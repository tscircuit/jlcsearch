import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  exactLcsc,
  fetchExactStock,
  readRequestedStock,
  requestStock,
} from "../cf-proxy/src/requested-stock"
import { refreshRequestedStock } from "../scripts/refresh-requested-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

const reply = (stock = 35904, code = "C7519") =>
  Response.json({
    code: 200,
    data: {
      componentPageInfo: {
        list: [
          {
            componentCode: code,
            stockCount: stock,
            componentModelEn: "USBLC6-2SC6",
            componentSpecificationEn: "SOT-23-6L",
            initialPrice: 0.18,
          },
        ],
      },
    },
  })

const adapter = (db: Database) =>
  ({
    prepare(sql: string) {
      const query = db.query(sql)
      return {
        bind(...args: any[]) {
          return {
            async run() {
              query.run(...args)
            },
            async first() {
              return query.get(...args)
            },
          }
        },
      }
    },
  }) as any

async function fixture(withPopularity = true) {
  const f = await stockDatabase()
  f.db.exec(
    await Bun.file(
      new URL(
        "../cf-proxy/migrations/0019_requested_stock.sql",
        import.meta.url,
      ),
    ).text(),
  )
  if (withPopularity) {
    f.db.exec(
      await Bun.file(
        new URL(
          "../cf-proxy/migrations/0028_requested_stock_popularity.sql",
          import.meta.url,
        ),
      ).text(),
    )
  }
  return { ...f, d1: adapter(f.db) }
}

const replyForRequest = (async (_url: unknown, init?: RequestInit) =>
  reply(10, JSON.parse(String(init?.body)).keyword)) as typeof fetch

test("repeated requests count at most hourly and older activity loses weight", async () => {
  const { db, d1 } = await fixture()
  try {
    await requestStock(d1, 7519)
    await requestStock(d1, 7519)
    const demand = db.query(
      "SELECT demand_score FROM _jlcsearch_requested_parts WHERE lcsc=?",
    )
    expect(demand.get(7519)).toEqual({ demand_score: 1 })

    const midnight = 20_000 * 86400
    db.query(
      "INSERT INTO _jlcsearch_requested_parts (lcsc, requested_at) VALUES (11702,?)",
    ).run(midnight)
    const request = db.query(
      "UPDATE _jlcsearch_requested_parts SET requested_at=? WHERE lcsc=11702",
    )
    for (const hours of [1, 2, 3]) request.run(midnight + hours * 3600)
    expect(demand.get(11702)).toEqual({ demand_score: 4 })
    request.run(midnight + 86400)
    expect(demand.get(11702)).toEqual({ demand_score: 3 })
  } finally {
    db.close()
  }
})

test("the hourly refresh stays bounded and leaves room for first-time requests", async () => {
  const { db, execute, targets } = await fixture()
  try {
    db.exec(`WITH RECURSIVE parts(id) AS (
      SELECT 1 UNION ALL SELECT id + 1 FROM parts WHERE id < 310
    )
    INSERT INTO _jlcsearch_requested_parts(lcsc, requested_at, attempted_at, demand_score)
    SELECT id, unixepoch(), CASE WHEN id <= 100 THEN 0 ELSE unixepoch()-7200 END,
      CASE WHEN id <= 100 THEN 1 ELSE 3 END FROM parts;`)
    const report = await refreshRequestedStock({
      execute,
      targets,
      fetcher: replyForRequest,
      pause: async () => {},
    })
    expect(report.map(({ lcsc }) => lcsc)).toEqual(
      Array.from({ length: 100 }, (_, i) => [
        i * 2 + 101,
        i * 2 + 102,
        i + 1,
      ]).flat(),
    )
  } finally {
    db.close()
  }
})

test("popular-only skips one-off, inactive, and recently attempted parts", async () => {
  const { db, execute, targets } = await fixture()
  try {
    db.exec(`INSERT INTO _jlcsearch_requested_parts(lcsc, requested_at, attempted_at, demand_score)
      VALUES (1,unixepoch(),0,1),
             (2,unixepoch(),0,3),
             (3,unixepoch()-86400,0,12),
             (4,unixepoch()-8*86400,0,40),
             (5,unixepoch(),unixepoch()-60,24);`)
    const report = await refreshRequestedStock({
      execute,
      targets,
      popularOnly: true,
      fetcher: replyForRequest,
      pause: async () => {},
    })
    expect(report.map(({ lcsc }) => lcsc)).toEqual([3, 2])
    const audit = await refreshRequestedStock({
      execute,
      targets,
      requestedIds: [1],
      fetcher: replyForRequest,
      pause: async () => {},
    })
    expect(audit.map(({ lcsc }) => lcsc)).toEqual([1])
  } finally {
    db.close()
  }
})

test("the existing stock queue still works while the popularity migration is pending", async () => {
  const { db, execute, targets, d1 } = await fixture(false)
  try {
    await requestStock(d1, 7519)
    const options = {
      execute,
      targets,
      fetcher: replyForRequest,
      pause: async () => {},
    }
    await expect(
      refreshRequestedStock({ ...options, popularOnly: true }),
    ).rejects.toThrow("popularity migration")
    expect(await refreshRequestedStock(options)).toMatchObject([{ lcsc: 7519 }])
  } finally {
    db.close()
  }
})

test("only exact numeric IDs are enrolled; supplier substitutes and malformed quantities are rejected", async () => {
  expect(exactLcsc(" c7519 ")).toBe(7519)
  for (const input of ["USBLC6", "C0", "C7519 OR 1=1", "9007199254740992", ""])
    expect(exactLcsc(input)).toBeNull()
  for (const response of [
    reply(3, "C75190"),
    reply(-1),
    reply(NaN),
    Response.json({ code: 200, data: { componentPageInfo: { list: [] } } }),
    new Response("blocked", { status: 429 }),
  ]) {
    await expect(
      fetchExactStock(7519, (async () => response) as any),
    ).rejects.toThrow()
  }
  expect(
    (await fetchExactStock(7519, (async () => reply(0)) as any)).stock,
  ).toBe(0)
})

test("the Standard-only mark is read from JLCPCB's componentProductType", async () => {
  const replyWithProductType = (componentProductType?: number) =>
    Response.json({
      code: 200,
      data: {
        componentPageInfo: {
          list: [
            {
              componentCode: "C7519",
              stockCount: 10,
              componentModelEn: "USBLC6-2SC6",
              componentProductType,
            },
          ],
        },
      },
    })
  const readMark = async (componentProductType?: number) =>
    (
      await fetchExactStock(7519, (async () =>
        replyWithProductType(componentProductType)) as any)
    ).is_standard_only
  expect(await readMark(2)).toBe(true)
  expect(await readMark(0)).toBe(false)
  // An absent field is unknown, not "economic-capable".
  expect(await readMark()).toBeNull()
})

test("BOM demand restores stock in all tables, preserves true zero, and survives catalog replacement", async () => {
  const { db, execute, targets, d1 } = await fixture()
  try {
    insertPart(db, 7519)
    await requestStock(d1, 7519)
    await requestStock(d1, 970725)
    const fetcher = (async (_url: any, init: any) => {
      const id = JSON.parse(init.body).keyword
      return reply(id === "C7519" ? 35904 : 0, id)
    }) as any
    const report = await refreshRequestedStock({
      execute,
      targets,
      fetcher,
      pause: async () => {},
    })
    expect(report).toHaveLength(2)
    for (const { name } of targets)
      expect(
        db.query(`SELECT stock FROM "${name}" WHERE lcsc=7519`).get(),
      ).toEqual({ stock: 35904 })
    expect(await readRequestedStock(d1, 970725)).toMatchObject({
      lcsc: 970725,
      stock: 0,
    })
    db.exec("DELETE FROM search_index; DELETE FROM component_catalog;")
    expect(await readRequestedStock(d1, 7519)).toMatchObject({
      lcsc: 7519,
      stock: 35904,
    })
    expect(
      await refreshRequestedStock({
        execute,
        targets,
        fetcher,
        pause: async () => {},
      }),
    ).toEqual([])
  } finally {
    db.close()
  }
})

test("expired observations stay unknown after a failed refresh; failed IDs cannot starve later requests", async () => {
  const { db, execute, targets, d1 } = await fixture()
  try {
    for (const id of [7519, 11702]) await requestStock(d1, id)
    const component = await fetchExactStock(7519, (async () => reply()) as any)
    db.query(
      "UPDATE _jlcsearch_requested_parts SET component_json=?,verified_at=unixepoch()-86400 WHERE lcsc=7519",
    ).run(JSON.stringify(component))
    const report = await refreshRequestedStock({
      execute,
      targets,
      pause: async () => {},
      fetcher: (async (_url: any, init: any) => {
        if (JSON.parse(init.body).keyword === "C7519")
          throw new Error("timeout")
        return reply(21744064, "C11702")
      }) as any,
    })
    expect(report.find((r) => r.lcsc === 7519)?.error).toContain("timeout")
    expect(report.find((r) => r.lcsc === 11702)?.stock).toBe(21744064)
    expect(await readRequestedStock(d1, 7519)).toMatchObject({ stock: null })
    expect(
      db
        .query(
          "SELECT verified_at < unixepoch()-3600 AS old FROM _jlcsearch_requested_parts WHERE lcsc=7519",
        )
        .get(),
    ).toEqual({ old: 1 })
  } finally {
    db.close()
  }
})

test("JLCPCB's null-list empty result is unknown, not a pipeline failure or zero stock", async () => {
  const { db, execute, targets, d1 } = await fixture()
  try {
    await requestStock(d1, 6998930)
    const report = await refreshRequestedStock({
      execute,
      targets,
      pause: async () => {},
      fetcher: (async () =>
        Response.json({
          code: 200,
          data: { componentPageInfo: { total: 0, list: null } },
        })) as any,
    })
    expect(report).toMatchObject([{ lcsc: 6998930, unknown: true }])
    expect(report[0].stock).toBeUndefined()
    expect(await readRequestedStock(d1, 6998930)).toBeNull()
    expect(
      db
        .query(
          "SELECT verified_at FROM _jlcsearch_requested_parts WHERE lcsc=6998930",
        )
        .get(),
    ).toEqual({ verified_at: null })
  } finally {
    db.close()
  }
})
