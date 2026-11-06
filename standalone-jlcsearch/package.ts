import {
  copyFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { buildStandaloneJlcsearch } from "./build"

export const validateReleaseVersion = (version: string) => {
  if (
    version.trim() !== version ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
  )
    throw new Error("Expected a release version such as 0.1.0")
  return version
}

/** Build a dependency-free Bun package; publishing is a separate workflow step. */
export async function buildStandalonePackage(options: {
  version: string
  outputDirectory?: string
  refreshCatalog?: boolean
}) {
  const version = validateReleaseVersion(options.version)
  const output = resolve(
    options.outputDirectory ?? join(import.meta.dir, "dist"),
  )
  await mkdir(dirname(output), { recursive: true })
  const staging = await mkdtemp(join(dirname(output), ".standalone-package-"))
  try {
    if (options.refreshCatalog) {
      await buildStandaloneJlcsearch({
        outputPath: join(staging, "search-catalog.json.gz"),
      })
    } else {
      await copyFile(
        join(import.meta.dir, "search-catalog.json.gz"),
        join(staging, "search-catalog.json.gz"),
      )
    }
    const result = await Bun.build({
      entrypoints: [join(import.meta.dir, "server.ts")],
      outdir: staging,
      target: "bun",
      format: "esm",
      banner: "#!/usr/bin/env bun",
    })
    if (!result.success)
      throw new AggregateError(result.logs, "Standalone package build failed")
    await writeFile(
      join(staging, "server.d.ts"),
      "export declare function createStandaloneJlcsearchHandler(catalogPath?: URL): Promise<(request: Request) => Promise<Response>>\n",
    )
    await writeFile(
      join(staging, "package.json"),
      `${JSON.stringify(
        {
          name: "@tscircuit/jlcsearch-standalone",
          version,
          description:
            "Offline JLC search API backed by a compressed common-parts catalog",
          license: "MIT",
          type: "module",
          main: "./server.js",
          types: "./server.d.ts",
          exports: {
            ".": { types: "./server.d.ts", import: "./server.js" },
            "./search-catalog.json.gz": "./search-catalog.json.gz",
          },
          bin: { "jlcsearch-standalone": "./server.js" },
          files: [
            "server.js",
            "server.d.ts",
            "search-catalog.json.gz",
            "LICENSE",
            "FORMAT.md",
          ],
          engines: { bun: ">=1.4.4" },
          repository: {
            type: "git",
            url: "git+https://github.com/tscircuit/jlcsearch.git",
            directory: "standalone-jlcsearch",
          },
          publishConfig: { registry: "https://npm.pkg.github.com" },
        },
        null,
        2,
      )}\n`,
    )
    await copyFile(
      join(import.meta.dir, "../LICENSE"),
      join(staging, "LICENSE"),
    )
    await copyFile(
      join(import.meta.dir, "FORMAT.md"),
      join(staging, "FORMAT.md"),
    )
    await rm(output, { recursive: true, force: true })
    await rename(staging, output)
    return output
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

if (import.meta.main)
  console.log(
    await buildStandalonePackage({
      version: Bun.argv[2] ?? "",
      refreshCatalog: process.env.REFRESH_CATALOG === "true",
    }),
  )
