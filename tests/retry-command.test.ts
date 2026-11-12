import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const retryScript = fileURLToPath(
  new URL("../cf-proxy/scripts/retry-command.sh", import.meta.url),
)

const runRetry = (command: string, ...args: string[]) =>
  Bun.spawnSync(["bash", retryScript, "bash", "-c", command, "mock", ...args], {
    env: {
      ...process.env,
      RETRY_MAX_ATTEMPTS: "2",
      RETRY_BASE_DELAY_SECONDS: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  })

test("a successful JSON retry only publishes the successful output", () => {
  const directory = mkdtempSync(join(tmpdir(), "jlcsearch-retry-test-"))
  try {
    const result = runRetry(
      `if [[ ! -e "$2" ]]; then
        touch "$2"
        echo '{"error":"temporary D1 failure"}'
        exit 1
      fi
      printf '%s' '[{"success":true}]'`,
      "--json",
      join(directory, "first-attempt"),
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toBe('[{"success":true}]')
    expect(result.stderr.toString()).toContain("temporary D1 failure")
    expect(result.stderr.toString()).toContain("failed on attempt 1/2")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("exhausted JSON retries log errors and preserve the exit code", () => {
  const result = runRetry(
    `echo '{"error":"permanent D1 failure"}'; exit 23`,
    "--json",
  )

  const stderr = result.stderr.toString()
  expect(result.exitCode).toBe(23)
  expect(result.stdout.toString()).toBe("")
  expect(stderr.match(/permanent D1 failure/g)).toHaveLength(2)
  expect(stderr).toContain("failed after 2 attempts")
})

test("a command without JSON mode keeps stdout and stderr separate", () => {
  const result = runRetry(`echo progress; echo warning >&2; exit 1`)

  expect(result.exitCode).toBe(1)
  expect(result.stdout.toString()).toBe("progress\nprogress\n")
  expect(result.stderr.toString()).toContain("warning")
})
