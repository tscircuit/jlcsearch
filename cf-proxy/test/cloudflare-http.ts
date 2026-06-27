const runtimeConfig = globalThis as typeof globalThis & {
  CF_TEST_BASE_URL?: string
}

export const BASE_URL =
  runtimeConfig.CF_TEST_BASE_URL ?? "https://jlcsearch.tscircuit.com"

export const buildUrl = (path: string): string =>
  new URL(path, BASE_URL).toString()

export async function fetchJson(path: string): Promise<{
  response: Response
  data: any
}> {
  const response = await fetch(buildUrl(path), {
    headers: { accept: "application/json" },
  })

  const text = await response.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `Expected JSON from ${path}, got ${response.status}: ${text.slice(0, 400)}`,
    )
  }

  return { response, data }
}
