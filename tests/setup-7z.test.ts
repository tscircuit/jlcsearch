import { expect, test } from "bun:test"
import { getSevenZipSetupPlan } from "../scripts/setup-7z"

test("uses the official Windows 7-Zip assets", () => {
  const plan = getSevenZipSetupPlan("win32", "x64")

  expect(plan).toEqual({
    kind: "windows",
    binaryName: "7za.exe",
    bootstrapUrl:
      "https://github.com/ip7z/7zip/releases/download/26.02/7zr.exe",
    archiveUrl:
      "https://github.com/ip7z/7zip/releases/download/26.02/7z2602-extra.7z",
    preferredArch: "x64",
  })
})

test("keeps the existing Linux standalone binary flow", () => {
  const plan = getSevenZipSetupPlan("linux", "x64")

  expect(plan).toEqual({
    kind: "posix",
    binaryName: "7zz",
    archiveUrl:
      "https://github.com/ip7z/7zip/releases/download/26.02/7z2602-linux-x64.tar.xz",
  })
})

test("rejects unsupported platforms", () => {
  expect(() => getSevenZipSetupPlan("freebsd", "x64")).toThrow(
    "Unsupported platform: freebsd-x64",
  )
})
