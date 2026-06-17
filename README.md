# PSMgr — Project Skills Manager

[![npm version](https://img.shields.io/npm/v/psmgr?color=blue)](https://www.npmjs.com/package/psmgr)
[![npm downloads](https://img.shields.io/npm/dm/psmgr?color=blue)](https://www.npmjs.com/package/psmgr)
[![license](https://img.shields.io/npm/l/psmgr?color=green)](LICENSE)

> **一行命令**为任意项目注入 AI Agent 技能、规则和工具管理。

```bash
npx psmgr install
```

安装后，AI Agent（Cursor / Windsurf / Trae / Claude Code 等）自动具备：
- **技能树调度** — L0→L1→L2 分层路由，按意图自动匹配技能
- **按需加载规则** — 仅加载当前任务需要的规则文件，节省 token
- **技术栈自适应** — 根据 Node/Python/Rust/Go 生成项目专属规范
- **工具依赖管理** — codegraph、gitnexus 等 CLI/MCP 一键安装和验证

---

## CLI 命令

| 命令 | 作用 |
|------|------|
| `npx psmgr install [-y] [target]` | 安装技能和规则到目标项目 |
| `npx psmgr check [target]` | 检测安装状态 |
| `npx psmgr info [target]` | 显示版本、环境、安装详情 |
| `npx psmgr list` | 列出本包携带的技能和规则 |
| `npx psmgr registry` | 查看技能注册中心（可用来源） |
| `npx psmgr discover [target]` | 根据项目技术栈推荐匹配技能 |
| `npx psmgr tool list [target]` | 查看工具安装状态和可用命令 |
| `npx psmgr tool install <name> [target]` | 安装工具（CLI 或 MCP，交互式选择） |
| `npx psmgr tool verify [target]` | 验证已安装工具的所有子命令可用性 |
| `npx psmgr tool setup [target]` | 扫描技能依赖，批量安装缺失工具 |
| `npx psmgr outdated` | 检查 npm 是否有新版本 |
| `npx psmgr update` | 自更新到最新版本 |

> 静默模式：`npx psmgr install -y`，跳过确认，适用于 CI。

---

## 安装后获得什么

### 🌳 技能树（L0 → L1 → L2 分层调度）

```
L0: managing-project-skills（入口）
  ├── L1: 🔧 生命周期管理 → L2: installing-project-skills
  ├── L1: 📋 任务调度     → L2: scheduling-project-skills
  └── L1: 📦 版本发布     → L2: generating-changelogs
```

Agent 读取 `INDEX.md` → 匹配用户意图 → 自动加载对应 SKILL.md 执行。

### ⚡ 按需加载规则

| 规则文件 | 加载方式 | 触发场景 |
|---------|---------|---------|
| `project-rules.md` | **全量加载** | 每次对话自动注入（含技术栈专属规范） |
| `skill-lifecycle-rules.md` | 按需 | 用户说安装/升级/卸载技能 |
| `skill-scheduling-rules.md` | 按需 | 技能执行任务时编排调度 |
| `changelog-rules.md` | 按需 | 更新更新日志 |
| `code-standards-rules.md` | 按需 | 修改代码时 |
| `version-management-rules.md` | 按需 | 版本发布时 |

### 🔧 工具管理

| 工具 | 用途 | 安装方式 |
|------|------|---------|
| **codegraph** | 符号搜索、调用图、影响分析 | `psm tool install codegraph`（CLI/MCP 可选） |
| **gitnexus** | Git blame、日志分析、变更影响 | `psm tool install gitnexus`（CLI/MCP 可选） |

安装后自动记录路径、验证子命令、写入 `tools.json`，技能可直接调用。

---

## 技术栈自适应

安装时自动检测项目类型，生成对应的 `project-rules.md`：

| 检测文件 | 项目类型 | 注入规范 |
|---------|---------|---------|
| `package.json` | Node.js / Frontend | ES6+、TypeScript strict、ESLint、Jest/Vitest |
| `pyproject.toml` / `requirements.txt` | Python | PEP 8、类型注解、Black + Ruff、pytest |
| `Cargo.toml` | Rust | rustfmt、clippy、Result 处理、cargo test |
| `go.mod` | Go | gofmt、go vet、显式错误处理、slog |
| 无匹配 | unknown | 通用规范 |

---

## 安装方式

### 方式一：npx（推荐）

```bash
npx psmgr install
```

无需全局安装，零依赖，自动下载并运行。

安装到其他目录：

```bash
npx psmgr install ../my-project
```

### 方式二：Git 子目录复制

```bash
git clone --depth 1 https://github.com/JiunianTV/Le-Skills.git .psm-tmp
cp -r .psm-tmp/.agents ./your-project/
cp -r .psm-tmp/scripts ./your-project/
rm -rf .psm-tmp
```

---

## 安装后的下一步

```bash
# 1. 运行检测脚本
bash scripts/bootstrap.sh

# 2. 在 IDE 中输入以下指令：
#    「安装技能和规则」  — 首次安装/配置
#    「更新技能和规则」  — 升级已有技能
#    「卸载技能 xxx」    — 移除指定技能
#    「查看技能」        — 查看技能状态
#    「有什么技能适合我」— 技能发现
#    「更新更新日志为 v1.0.0」 — 生成 CHANGELOG
```

---

## 目录结构

```
PSMgr/
├── bin/
│   └── psm.js                    # CLI 入口
├── .agents/
│   ├── skills/                   # 技能（每个目录一个 SKILL.md）
│   │   ├── INDEX.md              # 技能树 + 导航
│   │   ├── managing-project-skills/
│   │   ├── installing-project-skills/
│   │   ├── scheduling-project-skills/
│   │   └── generating-changelogs/
│   ├── rules/                    # 规则（按需加载）
│   │   ├── project-rules.md
│   │   ├── skill-lifecycle-rules.md
│   │   ├── skill-scheduling-rules.md
│   │   ├── changelog-rules.md
│   │   ├── code-standards-rules.md
│   │   ├── version-management-rules.md
│   │   └── templates/            # 技术栈规范模板
│   ├── skills-registry.json      # 技能注册中心
│   ├── skills-config.template.json
│   └── tools.json                # 已安装工具索引
├── scripts/
│   ├── bootstrap.js
│   └── bootstrap.sh
├── prompt/
│   └── Project-Skills-Manager.md
└── package.json
```

---

## CI 集成

```yaml
# .github/workflows/check-skills.yml
steps:
  - run: npx psmgr check
  - run: bash scripts/bootstrap.sh --check
```

技能未安装时 exit 1，已就绪 exit 0。

---

## 协议

MIT
