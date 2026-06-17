# 技能树 INDEX

> 🎯 **任何 AI Agent / AI IDE 的统一导航入口** — 安装后优先读取此文件了解技能结构
> 由 psm install 自动生成 — 运行 `npx psm install --yes` 重新生成

---

## 🤖 Agent 使用协议

任何 AI Agent 在加载本项目后，应按以下流程操作：

```
1. 读取本 INDEX.md ──────────────── 了解技能树结构和路由规则
2. 根据用户输入 + 项目上下文 ─────── 匹配「导航指南」或「条件路由」表
3. 加载对应的 L2 SKILL.md ───────── 技能文件含完整执行流程
4. 多技能任务 → 加载 skill-scheduling-rules.md
5. 执行完成 → 更新任务状态
```

**核心原则：** Agent 不应跳过技能树直接执行。先路由，再执行。

---

## 🌳 技能树总览

```
L0: managing-project-skills（根节点 — 用户入口）
  │
  ├── L1: 🔧 生命周期管理
  │     └── L2: installing-project-skills — 安装/更新/卸载/查看技能
  │
  ├── L1: 📋 任务调度
  │     └── L2: scheduling-project-skills — 技能编排/难度分级/场景映射
  │
  └── L1: 📦 版本发布
        └── L2: generating-changelogs — 从 git commit 生成 CHANGELOG.md
```

---

## 🧭 导航指南（按用户意图路由）

### 流程：用户发来消息 → 匹配 L1 类别 → 加载 L2 技能

| 用户说/场景 | → 匹配 L1 | → 加载 L2 技能 |
|------------|----------|---------------|
| "安装技能和规则" / "setup skills" | 🔧 生命周期管理 | `installing-project-skills` |
| "更新/升级/卸载技能 xxx" | 🔧 生命周期管理 | `installing-project-skills` |
| "查看技能" / "技能状态" | 🔧 生命周期管理 | `installing-project-skills` |
| 多技能编排/判断难度/复杂任务 | 📋 任务调度 | `scheduling-project-skills` |
| "更新更新日志为 vx.x.x" | 📦 版本发布 | `generating-changelogs` |
| "版本管理" / "版本规范" | 📦 版本发布 | 检查 `version-management-rules.md` |

---

## 🔀 条件路由（按项目上下文路由）

> 当用户意图不明确或涉及多个领域时，根据项目上下文自动选择路径。

| 项目上下文 | 用户意图模糊时 → 默认路径 | 说明 |
|-----------|------------------------|------|
| 项目无 `.agents/skills/` | → 直接触发 `installing-project-skills` full-install | 首次配置 |
| 项目有 `package.json` + React/Vue | → 优先路由到前端相关技能链 | 技术栈感知 |
| 项目有 `Cargo.toml` | → 路由到 Rust 工程链 | 内存安全/并发 |
| 项目有 `go.mod` | → 路由到 Go 微服务链 | 微服务/网络 |
| 项目有 `requirements.txt` / `pyproject.toml` | → 路由到 Python 数据链 | 数据处理/ML |
| 项目有 `package.json` + UI 框架 | → 额外评估前端设计技能（见 registry） | 设计技能匹配 |
| 用户说"帮我看看这个项目" | → 先 `installing-project-skills` status check | 快速诊断 |
| 错误信息中带有 stack trace | → 加载 `scheduling-project-skills` + 调试场景 | 异常处理 |

> **优先级：** 条件路由 > 导航指南。即项目上下文匹配时优先走条件路由，否则根据用户意图走导航指南。

---

## 📂 文件索引

| 文件 | 树路径 | 用途 |
|------|-------|------|
| `managing-project-skills/SKILL.md` | `root` | 根节点，L0 入口调度 |
| `installing-project-skills/SKILL.md` | `lifecycle/install` | L2，安装/更新/卸载/查看 |
| `scheduling-project-skills/SKILL.md` | `schedule/orchestrate` | L2，编排/调度/难度分级 |
| `generating-changelogs/SKILL.md` | `release/changelog` | L2，更新日志生成 |

---

## 🔌 跨平台兼容矩阵

| 平台 | 技能识别方式 | 规则加载方式 | 兼容状态 | 启用方式 |
|------|-------------|-------------|---------|---------|
| **Trae** | `.agents/skills/` 自动识别 | `.agents/rules/` 自动加载 | ✅ 原生支持 | 无需配置 |
| **Cursor** | `.cursor/rules/` + AGENTS.md | 文件匹配 | ⚠️ 需配置 | 安装后运行 `npx psm setup --cursor` |
| **Windsurf** | `.windsurf/` 目录 | 特定目录 | ⚠️ 需配置 | 安装后运行 `npx psm setup --windsurf` |
| **Claude Code** | `CLAUDE.md` | 全量 prompt | ⚠️ 部分支持 | 安装后 AGENTS.md 自动注入技能树入口 |
| **GitHub Copilot** | `.github/copilot-instructions.md` | 指令文件 | ❌ 未适配 | 需要手动配置 |
| **Cline / Roo Code** | `CLINE.md` / `ROO.md` | 全量 prompt | ❌ 未适配 | 暂无适配计划 |

> 平台适配层规划见 `.agents/adapters/`（未来版本）。

---

## ⚡ 按需加载决策表

| 触发条件 | 操作 | 加载方式 |
|---------|------|---------|
| 用户说「更新更新日志」「发布」「打 tag」 | 读取 `version-management-rules.md` 并应用 | 按需加载 |
| 用户说「修改代码」「新增」「提交代码」 | 读取 `code-standards-rules.md` 检查规范 | 按需加载 |
| 用户说「安装/更新/卸载技能」 | 读取 `skill-lifecycle-rules.md` 执行生命周期 | 按需加载 |
| 技能执行时编排任务 | 读取 `skill-scheduling-rules.md` 决定调度策略 | 按需加载 |
| 用户说「更新更新日志为 vx.x.x」 | 读取 `changelog-rules.md` 生成更新日志 | 按需加载 |
| 未匹配以上条件 | 仅使用 `project-rules.md`（已全量加载） | 全量加载 |

---

## 🛍️ 可安装技能市场

> 以下技能来自 `.agents/skills-registry.json`，可根据项目技术栈安装。

| 来源 | 技能 | 适用项目 | 安装条件 |
|------|------|---------|---------|
| superpowers | TDD、系统调试、验证循环 | 任何项目 | ✅ 始终推荐 |
| karpathy | 工程规范、调试方法论 | 任何项目 | ✅ 始终推荐 |
| ecc | React/Vue 前端、Jest/Cypress 测试 | Node/前端项目 | ⚠️ 技术栈匹配 |
| impeccable | 代码审查、UI 设计 | 前端/全栈项目 | ⚠️ 有 UI 框架 |
| taste-skill | 设计品味、前端美学 | 前端/全栈项目 | ⚠️ 有 UI 框架 |
| gitnexus | Git 代码智能（自管理） | 任何 Git 项目 | 🔄 自管理（CLI 安装） |
| codegraph | 符号搜索/调用图（自管理） | 任何项目 | 🔄 自管理（CLI 安装） |

> 用户自定义源：在项目根目录创建 `.agents/skills-config.json` 可添加私有技能源。

---

## 🔧 工具依赖管理

> 以下工具为技能提供 CLI/MCP 能力。通过 `psm tool install` 交互式安装，支持 CLI 和 MCP 两种方式。

| 工具 | 用途 | CLI 安装 | MCP 配置 | 状态索引 |
|------|------|---------|---------|---------|
| **codegraph** | 符号搜索、调用图、影响分析 | `curl ... install.sh \| sh` | `codegraph install` 自动配置 | `.agents/tools.json` |
| **gitnexus** | Git blame、日志分析、变更影响 | `npm install -g gitnexus` | `npx gitnexus@latest mcp` | `.agents/tools.json` |

**命令：**
- `npx psm tool list` — 查看所有工具安装状态
- `npx psm tool install <name>` — 交互式安装（选 CLI 还是 MCP）
- `npx psm tool setup` — 扫描已安装技能，批量安装缺失工具

---

## 相关工具

| 工具 | 用途 | 位置 |
|------|------|------|
| `psm` CLI | 安装/更新/卸载技能和规则 | `npx psm install` |
| `bootstrap.js` | 跨平台项目检测 + 技能安装状态 | `scripts/bootstrap.js` |
| `bootstrap.sh` | Linux/macOS 版项目检测 | `scripts/bootstrap.sh` |
| `skills-registry.json` | 技能注册中心（可扩展） | `.agents/skills-registry.json` |

> **注意：** 本 INDEX.md 由 psm 维护。任何 AI IDE（Cursor / Windsurf / Trae / Claude Code / GitHub Copilot）均可通过读取此文件理解技能树结构。
