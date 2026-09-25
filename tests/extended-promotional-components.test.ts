import { describe, expect, test } from "bun:test"
import { fetchExtendedPromotionalComponents } from "../lib/extended-promotional-components"

const row = (code: number, type = "expand") => ({
  componentCode: `C${code}`,
  componentLibraryType: type,
})
const page = (list: unknown[], total = list.length) => ({
  code: 200,
  data: { componentPageInfo: { list, total, hasNextPage: false } },
})
function mockFetch(pages: unknown[]) {
  const requests: RequestInit[] = []
  let index = 0
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (index++ === 0)
      return new Response("{}", {
        headers: { "Set-Cookie": "XSRF-TOKEN=test-session; Path=/" },
      })
    requests.push(init!)
    return Response.json(pages.shift())
  }
  return { fetcher, requests }
}

describe("extended promotional catalog", () => {
  test("extracts extended members of the real basic/promotional catalog", async () => {
    const { fetcher, requests } = mockFetch([
      page([row(1002, "base"), row(1034)]),
    ])
    expect(await fetchExtendedPromotionalComponents(fetcher)).toEqual([1034])
    expect(JSON.parse(requests[0]!.body as string)).toEqual({
      currentPage: 1,
      pageSize: 1000,
      componentLibraryType: "base",
      preferredComponentFlag: true,
    })
  })
  test("uses total rather than unreliable hasNextPage and collects all pages", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => row(i + 1, "base"))
    const { fetcher, requests } = mockFetch([
      page(first, 1001),
      page([row(1034)], 1001),
    ])
    expect(await fetchExtendedPromotionalComponents(fetcher)).toEqual([1034])
    expect(requests).toHaveLength(2)
  })
  test.each([
    [page([])],
    [page([row(1002, "base")])],
    [page([row(1034), row(1034)])],
    [page([row(1034, "unexpected")])],
    [page([row(1034)], 2)],
    [{ code: 500 }],
    [page([row(0)])],
  ])(
    "rejects an invalid, incomplete or empty promotion feed",
    async (payload) => {
      const { fetcher } = mockFetch([payload])
      await expect(
        fetchExtendedPromotionalComponents(fetcher),
      ).rejects.toThrow()
    },
  )
  test("does not return a partial catalog when a later page fails", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => row(i + 1))
    const { fetcher } = mockFetch([page(first, 1001), { code: 500 }])
    await expect(fetchExtendedPromotionalComponents(fetcher)).rejects.toThrow()
  })
  test("does not call the catalog without a valid session", async () => {
    const fetcher = async () => new Response("{}")
    await expect(fetchExtendedPromotionalComponents(fetcher)).rejects.toThrow(
      "XSRF token",
    )
  })
})
