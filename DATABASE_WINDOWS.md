# Windows 安装数据库指南

**问题：** `bun run setup` 在 Windows 上不支持（需要 7-Zip）

**解决方案：** 直接下载优化后的数据库文件

---

## 方案 1：直接下载优化数据库（推荐）

根据 README，可以从官方源直接下载：

```bash
# 需要 DATABASE_DOWNLOAD_TOKEN 环境变量
curl -o db.sqlite "https://jlcsearch.fly.dev/database/$DATABASE_DOWNLOAD_TOKEN"
```

**问题：** 需要 token，可能需要联系项目方获取

---

## 方案 2：使用 WSL（完整支持）

```bash
# 1. 安装 WSL
wsl --install

# 2. 重启后进入 WSL
wsl

# 3. 在 WSL 中安装 Bun
curl -fsSL https://bun.sh/install | bash

# 4. 克隆项目并运行 setup
git clone https://github.com/tscircuit/jlcsearch.git
cd jlcsearch
bun install
bun run setup
```

**优点：** 完整支持所有功能
**缺点：** 需要 WSL，耗时较长

---

## 方案 3：跳过数据库，直接开发（推荐用于 Issue #92）

**对于 Issue #92，不需要完整数据库！**

**原因：**
- Issue #92 只修改数据表定义和 API
- 不需要查询真实数据
- 测试可以写单元测试

**开发流程：**
```bash
# 1. 查看现有表定义
cat lib/db/derivedtables/resistor.ts

# 2. 添加新字段（is_extended_promotional）
# 3. 更新 API 路由
# 4. 编写单元测试
# 5. 提交 PR
```

---

## 方案 4：手动安装 7-Zip 后运行 setup

```powershell
# 1. 手动运行下载的 7z 安装程序
$env:TEMP\7z.exe /S /D="C:\Program Files\7-Zip"

# 2. 添加 7z 到 PATH
$env:Path += ";C:\Program Files\7-Zip"

# 3. 重新运行 setup
bun run setup
```

**预计耗时：** 30-60 分钟
**下载大小：** 约 2GB

---

## 兜兜推荐

**对于 Issue #92 开发：方案 3（跳过数据库）**

**理由：**
1. ✅ 不需要数据库即可开发
2. ✅ 节省时间和磁盘空间
3. ✅ 专注于代码修改
4. ✅ 测试可以后补

**何时需要数据库：**
- 需要做完整集成测试
- 需要验证真实数据查询
- PR 合并前的最终验证

---

## 下一步

如果先生想要完整数据库，建议：
1. 使用 WSL（最稳定）
2. 或联系项目方获取数据库下载 token

如果只是开发 Issue #92：
→ 直接开始编写代码，无需数据库！

---

**更新时间:** 2026-03-10 10:35
**建议人:** 兜兜
