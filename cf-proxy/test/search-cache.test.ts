import { expect, it, vi } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { getD1RefreshCoordinator } from "../src/d1-refresh"
import { createSelf, createTestEnv } from "./test-env"

// Exercise real FTS/LIKE results as well as cache hits in the Worker runtime.
const workerTest = "Bun" in globalThis ? it.skip : it

const fixture = async () => {
  const { env: runtime } = await import("cloudflare:test")
  const schema = `CREATE TABLE search_index (
    lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
    subcategory TEXT, search_text TEXT
  );
  CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO search_index_fts_meta VALUES ('ready_lcsc','1');
  CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
  CREATE TABLE _jlcsearch_requested_parts (
    lcsc INTEGER PRIMARY KEY, requested_at INTEGER, verified_at INTEGER, component_json TEXT
  );
  INSERT INTO search_index(lcsc,mfr,package,description,stock,price,price1,basic,preferred,subcategory,search_text)
  VALUES
    (1,'R1','0805','Resistor',100,'1-:0.1',0.1,1,0,'Chip Resistors','resistor 0805'),
    (2,'R2','0603','Resistor',50,'1-:0.2',0.2,0,1,'Chip Resistors','resistor 0603'),
    (3,'C3','0805','Capacitor',75,'1-:0.3',0.3,1,0,'Capacitors','capacitor 0805'),
    (4,'U4','','Single space',80,'1-:1',1,0,0,'Other','电源 连接'),
    (5,'U5','','Double space',70,'1-:1',1,0,0,'Other','电源  连接');
  INSERT INTO search_index_fts(rowid,search_text) SELECT lcsc,search_text FROM search_index;`
  for (const sql of schema.split(";").filter((sql) => sql.trim()))
    await runtime.DB.prepare(sql).run()
  const queries: string[] = []
  const env = createTestEnv()
  env.USE_D1 = "true"
  env.DB = {
    prepare(sql: string) {
      queries.push(sql)
      return runtime.DB.prepare(sql)
    },
  } as D1Database
  return { env, queries, self: createSelf(env), db: runtime.DB }
}

const components = async (response: Response) => {
  expect(response.status).toBe(200)
  const body = (await response.json()) as { components: { lcsc: number }[] }
  return body.components.map((row) => row.lcsc)
}

workerTest.each([
  ["/api/search", "q", false],
  ["/api/search.json", "q", false],
  ["/components/list.json", "search", false],
  ["/components/list?json=true", "search", false],
  ["/components/list", "search", true],
] as const)(
  "%s reuses JSON results for case and whitespace variants",
  async (path, parameter, acceptJson) => {
    const { self, queries, env } = await fixture()
    for (const [i, query] of [
      "  RESISTOR   0805  ",
      "resistor 0805",
      "Resistor\t\n0805",
    ].entries()) {
      const url = new URL(path, "https://example.com")
      url.searchParams.set(parameter, query)
      const response = await self.fetch(url, {
        headers: acceptJson ? { accept: "application/json" } : {},
      })
      expect(response.headers.get("x-cache")).toBe(i ? "HIT" : "MISS")
      expect(await components(response)).toEqual([1])
    }
    // Only one readiness read and one search, even when the first spelling was not canonical.
    expect(queries).toHaveLength(2)
    expect((await env.CACHE_KV.list()).keys).toHaveLength(1)
  },
)

workerTest(
  "default and zero-padded limits share results, but different limits do not",
  async () => {
    const { self, queries } = await fixture()
    const base = "https://example.com/api/search?q=resistor"
    for (const [i, limit] of ["", "&limit=100", "&limit=00100"].entries()) {
      const response = await self.fetch(base + limit)
      expect(response.headers.get("x-cache")).toBe(i ? "HIT" : "MISS")
      expect(await components(response)).toEqual([1, 2])
    }
    expect(queries).toHaveLength(2)
    expect(await components(await self.fetch(`${base}&limit=1`))).toEqual([1])
    expect(queries).toHaveLength(4)
    const sameLimit = await self.fetch(`${base}&limit=01`)
    expect(sameLimit.headers.get("x-cache")).toBe("HIT")
    expect(await components(sameLimit)).toEqual([1])
    expect(queries).toHaveLength(4)
  },
)

workerTest.each([
  ["q=resistor", "q=capacitor", [1, 2], [3]],
  ["q=resistor&package=0805", "q=resistor&package=0603", [1], [2]],
  [
    "q=resistor&subcategory_name=Chip+Resistors",
    "q=resistor&subcategory_name=chip+resistors",
    [1, 2],
    [],
  ],
  ["q=resistor&is_basic=1", "q=resistor&is_basic=0", [1], [1, 2]],
  ["q=resistor&is_preferred=1", "q=resistor&is_preferred=0", [2], [1, 2]],
  ["q=resistor+0805", "q=resistor0805", [1], []],
] as const)(
  "keeps different searches/filters separate: %s and %s",
  async (first, second, firstIds, secondIds) => {
    const { self, queries } = await fixture()
    for (const [query, ids] of [
      [first, firstIds],
      [second, secondIds],
    ] as const) {
      const response = await self.fetch(
        `https://example.com/api/search?${query}`,
      )
      expect(response.headers.get("x-cache")).toBe("MISS")
      expect(await components(response)).toEqual(ids)
    }
    expect(queries).toHaveLength(4)
  },
)

workerTest("Unicode-only phrase spacing remains significant", async () => {
  const { self, queries } = await fixture()
  for (const [query, ids] of [
    ["电源 连接", [4]],
    ["电源  连接", [5]],
  ] as const) {
    const response = await self.fetch(
      `https://example.com/api/search?q=${encodeURIComponent(query)}`,
    )
    expect(response.headers.get("x-cache")).toBe("MISS")
    expect(await components(response)).toEqual(ids)
  }
  expect(queries).toHaveLength(4)
})

workerTest(
  "package-filtered text searches keep exact matches and stock ordering",
  async () => {
    const { self, db } = await fixture()
    await db
      .prepare(`INSERT INTO search_index(lcsc, package, stock, search_text)
      VALUES
        (6, '0805', 120, 'resistor 0805'),
        (7, '0603', 150, 'resistor 0603 replaces an 0805 part'),
        (8, 'SOT-23', 90, 'resistor sot-23'),
        (9, 'AB', 100, 'resistor ab'),
        (10, 'SIP"4', 100, 'resistor sip"4')`)
      .run()
    await db
      .prepare(`INSERT INTO search_index_fts(rowid, search_text)
      SELECT lcsc, search_text FROM search_index WHERE lcsc >= 6`)
      .run()

    for (const [packageCode, ids] of [
      ["0805", [6, 1]],
      ["SOT-23", [8]],
      ["sot-23", []],
      ["AB", [9]],
      ['SIP"4', [10]],
    ] as const) {
      const encoded = encodeURIComponent(packageCode)
      for (const route of [
        "/api/search?q=resistor",
        "/components/list.json?search=resistor",
      ]) {
        const response = await self.fetch(
          `https://example.com${route}&package=${encoded}`,
        )
        expect(await components(response)).toEqual(ids)
      }
    }
    const limited = await self.fetch(
      "https://example.com/api/search?q=resistor&package=0805&limit=1",
    )
    expect(await components(limited)).toEqual([6])
  },
)

workerTest(
  "blank and omitted text reuse the same unfiltered JSON result",
  async () => {
    const { self, queries } = await fixture()
    for (const [i, suffix] of ["?q=%20%20", "?q=", ""].entries()) {
      const response = await self.fetch(
        `https://example.com/api/search${suffix}`,
      )
      expect(response.headers.get("x-cache")).toBe(i ? "HIT" : "MISS")
      expect(await components(response)).toEqual([1, 4, 3, 5, 2])
    }
    expect(queries).toHaveLength(1)
  },
)

workerTest(
  "HTML keeps the visitor's original search and never receives a JSON body",
  async () => {
    const { self } = await fixture()
    const base = "https://example.com/components/list?search="
    for (const query of ["RESISTOR  0805", "resistor 0805"]) {
      const url = base + encodeURIComponent(query)
      const html = await self.fetch(url)
      expect(html.headers.get("content-type")).toContain("text/html")
      expect(html.headers.get("x-cache")).toBe("MISS")
      expect(await html.text()).toContain(
        `<title>${query} - JLCPCB Component Search</title>`,
      )
      const json = await self.fetch(url, {
        headers: { accept: "application/json" },
      })
      expect(json.headers.get("x-cache")).toBe(
        query.startsWith("RESISTOR") ? "MISS" : "HIT",
      )
      expect(await components(json)).toEqual([1])
      const cachedHtml = await self.fetch(url)
      expect(cachedHtml.headers.get("x-cache")).toBe("HIT")
      expect(await cachedHtml.text()).toContain(
        `<title>${query} - JLCPCB Component Search</title>`,
      )
    }
  },
)

workerTest("validation runs before normalization or a cache hit", async () => {
  const { self, queries } = await fixture()
  await self.fetch("https://example.com/api/search?q=resistor+0805")
  expect(queries).toHaveLength(2)
  for (const suffix of [
    `q=${encodeURIComponent(`resistor${" ".repeat(260)}0805`)}`,
    "q=resistor+0805&limit=1e2",
    "q=resistor+0805&limit=1001",
    "q=resistor+0805&limit=",
  ]) {
    const response = await self.fetch(
      `https://example.com/api/search?${suffix}`,
    )
    expect(response.status).toBe(400)
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
  expect(queries).toHaveLength(2)
})

workerTest(
  "exact part lookups still bypass cache and record fresh demand",
  async () => {
    const { self, env, queries } = await fixture()
    for (const query of ["C1", " c1 ", "1"]) {
      const response = await self.fetch(
        `https://example.com/api/search?q=${encodeURIComponent(query)}`,
      )
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(await components(response)).toEqual([1])
    }
    expect(
      queries.filter((sql) =>
        sql.includes("INSERT INTO _jlcsearch_requested_parts"),
      ),
    ).toHaveLength(3)
    expect((await env.CACHE_KV.list()).keys).toHaveLength(0)
  },
)

workerTest(
  "cachebust refreshes the shared entry for all equivalent spellings",
  async () => {
    const { self, queries, db } = await fixture()
    const base = "https://example.com/api/search?q=resistor+0805"
    expect(await components(await self.fetch(base))).toEqual([1])
    await db.prepare("UPDATE search_index SET stock=0 WHERE lcsc=1").run()
    const refreshed = await self.fetch(
      "https://example.com/api/search?q=RESISTOR+++0805&limit=100&cachebust=1",
    )
    expect(refreshed.headers.get("x-cache")).toBe("BUST")
    expect(await components(refreshed)).toEqual([])
    const cached = await self.fetch(base)
    expect(cached.headers.get("x-cache")).toBe("HIT")
    expect(await components(cached)).toEqual([])
    expect(queries).toHaveLength(4)
  },
)

workerTest.each([1, 20])(
  "reuses a %i-minute-old legacy entry without resetting its age",
  async (age) => {
    const { self, queries, env } = await fixture()
    const url = new URL(
      "https://example.com/api/search?q=RESISTOR+++0805&limit=100",
    )
    const key = await generateCacheKey(url)
    const cachedAt = new Date(Date.now() - age * 60_000).toISOString()
    await env.CACHE_KV.put(key, '{"components":[{"lcsc":2}]}', {
      metadata: {
        cachedAt,
        status: 200,
        headers: { "content-type": "application/json" },
      },
    })
    const response = await self.fetch(url)
    expect(response.headers.get("x-cache")).toBe(age === 1 ? "HIT" : "STALE")
    expect(response.headers.get("x-cached-at")).toBe(cachedAt)
    expect(await components(response)).toEqual([2])
    await self.flushWaitUntil()
    expect(queries).toHaveLength(age === 1 ? 0 : 2)
    if (age === 20) {
      const refreshed = await self.fetch(
        "https://example.com/api/search?q=resistor+0805",
      )
      expect(refreshed.headers.get("x-cache")).toBe("HIT")
      expect(await components(refreshed)).toEqual([1])
      expect(queries).toHaveLength(2)
    }
  },
)

workerTest(
  "overlapping equivalent searches share one query and cache write",
  async () => {
    const { self, env, queries } = await fixture()
    const coordinator = getD1RefreshCoordinator(env.CACHE_KV)
    const run = coordinator.run.bind(coordinator)
    const variants = ["resistor 0805", "RESISTOR  0805", " Resistor\t0805 "]
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let joined = 0
    const spy = vi
      .spyOn(coordinator, "run")
      .mockImplementation((key, produce) => {
        const pending = run(key, async () => {
          await gate
          return produce()
        })
        if (++joined === variants.length) release()
        return pending
      })
    const put = vi.spyOn(env.CACHE_KV, "put")
    try {
      const responses = await Promise.all(
        variants.map((query, i) =>
          self.fetch(
            `https://example.com/api/search?q=${encodeURIComponent(query)}`,
            { headers: { origin: `https://client${i}.example` } },
          ),
        ),
      )
      for (const [i, response] of responses.entries()) {
        expect(response.headers.get("access-control-allow-origin")).toBe(
          `https://client${i}.example`,
        )
        expect(await components(response)).toEqual([1])
      }
      await self.flushWaitUntil()
      expect(queries).toHaveLength(2)
      expect(put).toHaveBeenCalledTimes(1)
    } finally {
      release()
      spy.mockRestore()
      put.mockRestore()
    }
  },
)
