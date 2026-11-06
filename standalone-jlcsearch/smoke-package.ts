import { resolve } from "node:path"

/** Run against an extracted npm tarball, so missing packaged assets fail before publish. */
export async function smokePackage(directory: string) {
  const child = Bun.spawn([process.execPath, resolve(directory, "server.js")], {
    env: { ...process.env, PORT: "0" },
    stdout: "pipe",
    stderr: "pipe",
  })
  const timeout = setTimeout(() => child.kill(), 10_000)
  try {
    const reader = child.stdout.getReader()
    let startup = ""
    while (!startup.includes("\n")) {
      const { value, done } = await reader.read()
      if (done)
        throw new Error(
          `Packaged service exited before listening: ${await new Response(child.stderr).text()}`,
        )
      startup += new TextDecoder().decode(value)
    }
    reader.releaseLock()
    const baseUrl = startup.match(
      /TSCIRCUIT_JLCSEARCH_BASE_URL=(http:\/\/127\.0\.0\.1:\d+)/,
    )?.[1]
    if (!baseUrl)
      throw new Error("Packaged service did not advertise a loopback URL")
    const response = await fetch(`${baseUrl}/api/search?q=C2040&limit=10`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (
      !response.ok ||
      !(await response.json()).components.some(
        (row: { lcsc: number }) => row.lcsc === 2040,
      )
    )
      throw new Error("Packaged service could not find bundled C2040")
    console.log("Packed standalone service smoke test passed")
  } finally {
    clearTimeout(timeout)
    child.kill()
    await child.exited
  }
}

if (import.meta.main)
  await smokePackage(Bun.argv[2] ?? "standalone-jlcsearch/dist")
