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

async function fixture() {
  const f = await stockDatabase()
  f.db.exec(
    await Bun.file(
      new URL(
        "../cf-proxy/migrations/0019_requested_stock.sql",
        import.meta.url,
      ),
    ).text(),
  )
  return { ...f, d1: adapter(f.db) }
}

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
