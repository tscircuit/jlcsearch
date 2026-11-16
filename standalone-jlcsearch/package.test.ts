import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildStandalonePackage, validateReleaseVersion } from "./package"
import { smokePackage } from "./smoke-package"

const run = async (args: string[], cwd: string) => {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code) throw new Error(`${args[0]} failed: ${stderr}`)
  return stdout
}

test("release tarball contains a runnable service and its compressed data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jlcsearch-package-"))
  try {
    const output = await buildStandalonePackage({
      version: "0.1.2",
      outputDirectory: join(directory, "dist"),
    })
    const packed = JSON.parse(
      await run(
        ["npm", "pack", output, "--ignore-scripts", "--json"],
        directory,
      ),
    )[0]
    expect(
      packed.files.map((file: { path: string }) => file.path).sort(),
    ).toEqual([
      "FORMAT.md",
      "LICENSE",
      "package.json",
      "search-catalog.json.gz",
      "server.d.ts",
      "server.js",
    ])
    await mkdir(join(directory, "extracted"))
    await run(["tar", "-xzf", packed.filename, "-C", "extracted"], directory)
    const extracted = join(directory, "extracted/package")
    const manifest = JSON.parse(
      await readFile(join(extracted, "package.json"), "utf8"),
    )
    expect(manifest.name).toBe("@tscircuit/jlcsearch-standalone")
    expect(manifest.version).toBe("0.1.2")
    expect(manifest.dependencies).toBeUndefined()
    await smokePackage(extracted)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 20_000)

test("publishing is manual only and requires a release version", async () => {
  const workflow = Bun.YAML.parse(
    await Bun.file(
      new URL(
        "../.github/workflows/publish-jlcsearch-standalone.yml",
        import.meta.url,
      ),
    ).text(),
  ) as { on: Record<string, unknown> }
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"])
  expect(validateReleaseVersion("0.1.0")).toBe("0.1.0")
  for (const invalid of [
    "",
    "latest",
    "v1.0.0",
    "01.0.0",
    "1.0.0/other",
    "1.0.0\nextra",
    "1.0.0\n",
  ]) {
    expect(() => validateReleaseVersion(invalid)).toThrow("release version")
  }
})
