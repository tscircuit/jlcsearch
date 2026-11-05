const runtimeConfig = globalThis as typeof globalThis & {
  CF_TEST_BASE_URL?: string
  process?: { env?: { CF_TEST_BASE_URL?: string } }
}

// Remote contracts must target an explicitly selected deployment. Ordinary
// branch tests must not depend on production availability or deployed code.
export const BASE_URL =
  runtimeConfig.CF_TEST_BASE_URL ?? runtimeConfig.process?.env?.CF_TEST_BASE_URL

export const buildUrl = (path: string): string => {
  if (!BASE_URL) throw new Error("Set CF_TEST_BASE_URL to run remote contracts")
  return new URL(path, BASE_URL).toString()
}

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
