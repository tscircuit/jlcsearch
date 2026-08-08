// 测试环境验证脚本
// 用法：bun run test-env.ts

import { existsSync } from "fs"
import { join } from "path"

console.log("🧪 测试环境验证\n")

const checks = [
  { name: "Node.js", check: () => process.version },
  { name: "Bun", check: () => Bun.version },
  {
    name: "项目目录",
    check: () =>
      existsSync(join(import.meta.dir, "package.json")) ? "✅" : "❌",
  },
  {
    name: "node_modules",
    check: () =>
      existsSync(join(import.meta.dir, "node_modules")) ? "✅" : "❌",
  },
  {
    name: "routes 目录",
    check: () => (existsSync(join(import.meta.dir, "routes")) ? "✅" : "❌"),
  },
  {
    name: "lib 目录",
    check: () => (existsSync(join(import.meta.dir, "lib")) ? "✅" : "❌"),
  },
  {
    name: "scripts 目录",
    check: () => (existsSync(join(import.meta.dir, "scripts")) ? "✅" : "❌"),
  },
]

let passed = 0
let failed = 0

for (const test of checks) {
  try {
    const result = test.check()
    console.log(`✅ ${test.name}: ${result}`)
    passed++
  } catch (error) {
    console.error(`❌ ${test.name}: ${error}`)
    failed++
  }
}

console.log("\n" + "=".repeat(50))
console.log(`结果：${passed} 通过，${failed} 失败`)

if (failed === 0) {
  console.log("\n✅ 测试环境准备完成！")
  console.log("\n下一步：")
  console.log("1. 运行 `bun run setup` 下载数据库（可选，约 2GB）")
  console.log("2. 或直接开始开发（不需要完整数据库）")
  console.log("3. 运行 `bun run format` 格式化代码")
} else {
  console.log("\n⚠️ 部分检查未通过，请检查安装")
}
