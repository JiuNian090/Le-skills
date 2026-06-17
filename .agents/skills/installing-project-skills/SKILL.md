---
name: installing-project-skills
description: Use when installing skills for a new project, or when the user asks to update, upgrade, uninstall, or check status of project skills
tree: lifecycle/install
---

# Installing Project Skills

> 📍 **技能树位置：L1/L2 — 生命周期管理/安装** — 受 managing-project-skills（根节点）分派

## Overview

Covers the full lifecycle of project skills: first-time install, migration from other directories, upgrade from upstream repos, uninstall, and status checks.

## When to Use

- User says "安装技能和规则" / "setup skills" — full install
- User says "更新技能" / "升级技能" / "同步技能" — upgrade existing
- User says "卸载技能 xxx" — remove a skill
- User says "查看技能" / "技能状态" — list and verify

## Core Flow

### 1. Detect Project Info

Read `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod` to determine tech stack. If none found, ask.

### 2. Scan Existing Skills

Search `**/SKILL.md` and `**/skill.md` across the project. Target dirs: `.agents/skills/`, `.trae/skills/`, `skills/`, `.skills/`, `docs/skills/`.

**Self-managed tools (DO NOT migrate):** GitNexus, codegraph — they manage their own skill dirs via CLI.

### 2.5. Scan & Extract Existing Rules from AGENTS.md / CLAUDE.md

**Why:** Projects often have version management and code standards rules embedded in AGENTS.md or CLAUDE.md. These should be extracted to `.agents/rules/` so they become discoverable by le-skills and don't duplicate across files.

**Detection:** Scan AGENTS.md and CLAUDE.md for these patterns:

| Rule type | Search keywords |
|-----------|----------------|
| 版本管理 | 版本管理、版本更新、版本号、versioning、changelog、更新日志、release |
| 代码规范 | 代码规范、编码规范、提交规范、code style、commit convention、代码风格、lint |

**Action for each detected match:**

1. **Ask the user:** "检测到 AGENTS.md 中包含版本管理/代码规范规则。要提取到 `.agents/rules/` 并替换为引用吗？"
2. **If yes:** Extract the section(s) to the corresponding rule file (`version-management-rules.md` or `code-standards-rules.md`), then replace the original section in AGENTS.md with a short reference: `> **版本管理：** 详见 \`.agents/rules/version-management-rules.md\``
3. **If no:** Leave as-is, but record in INDEX.md as "未提取（用户选择保留）"
4. **If AGENTS.md doesn't exist:** Generate AGENTS.md with the required loading chain reference

**Loading chain:** Ensure AGENTS.md has the mandatory rule-loading instruction. If not, inject:
```markdown
---
## le-skills 规则加载链

**每次任务开始前必须加载以下规则文件：**
- `.agents/rules/project-rules.md` — 全量加载
- `.agents/rules/skill-scheduling-rules.md` — 按需加载
- `.agents/rules/code-standards-rules.md` — 按需加载
- `.agents/rules/version-management-rules.md` — 按需加载
```

**CLAUDE.md:** If CLAUDE.md exists and doesn't have `@AGENTS.md`, prepend it. This is automatically handled by `npx le-skills install`.

### 3. Integrate Upstream Repos

Clone or pull from these skill sources. Use the **skill mapping** below to extract applicable skills — do NOT blindly copy all files.

| Repo | Available skills | Applies to | Install when |
|---|---|---|---|
| `affaan-m/ECC` | `frontend-react`, `frontend-vue`, `testing-cypress`, `testing-jest`, `api-client`, `state-management` | React / Vue / Node projects | Project uses React/Vue/Node + matching framework |
| `abhigyanpatwari/GitNexus` | `gitnexus-*` (Git code intelligence, blame, log analysis) | Any project using git | Always (self-managed — do NOT migrate) |
| `colbymchenry/codegraph` | `codegraph-*` (symbol search, call graph, impact analysis) | Any project (Go/Python/TS/JS) | Always (self-managed — do NOT migrate) |
| `obra/superpowers` | `test-driven-development`, `systematic-debugging`, `verification-loop`, `flatten-with-flags`, `condition-based-waiting` | Any project | Always — general engineering patterns |
| `multica-ai/andrej-karpathy-skills` | `karpathy-engineering`, `karpathy-debugging`, `karpathy-architecture` | Any project | Always — engineering discipline |
| `pbakaus/impeccable` | `impeccable-code-review`, `impeccable-ui` | Frontend / Full-stack | Only if project has a UI framework (React/Vue/Angular/Svelte) |
| `Leonxlnx/taste-skill` | `taste-frontend`, `taste-design` | Frontend / Full-stack | Only if project has a UI framework and prioritises design quality |

**Self-managed tools** (GitNexus, codegraph): they automatically download/update skills to their own directories via CLI. Detect and skip during migration — do NOT move them into `.agents/skills/`.

**Design skill evaluation rule:** Only install `impeccable` and `taste-skill` when `package.json` exists AND includes a UI framework dependency (react/vue/angular/svelte). Otherwise skip with a note.

### 4. Tech-Stack Filtering

| Project type | Priority skills |
|---|---|
| Node/frontend (package.json) | Design, testing, code-quality |
| Python (requirements.txt/pyproject.toml) | Data, ML, API |
| Rust (Cargo.toml) | Memory-safe, concurrent |
| Go (go.mod) | Microservice, container |
| Full-stack | Combined from both tiers |

### 5. User Confirmation & Customization

**Before any files are written**, present a full checklist to the user and let them customize:

#### 5a. Present the Checklist

Show the user a structured summary:

```
📋 安装计划确认

【待安装】来自上游仓库
  □ superpowers/test-driven-development
  □ superpowers/systematic-debugging
  □ karpathy/karpathy-engineering
  □ ECC/frontend-react          ← 仅在匹配技术栈时
  □ impeccable/impeccable-ui    ← 仅在有 UI 框架时

【待迁移】来自旧目录
  □ .trae/skills/xxx → .agents/skills/xxx

【待删除】旧目录（迁移完成后）
  □ .trae/skills/
  □ skills/                      ← 仅当所有内容已迁移
  □ .skills/

【待生成】规则文件
  □ skill-lifecycle-rules.md
  □ skill-scheduling-rules.md
  □ changelog-rules.md
  □ project-rules.md
  □ version-management-rules.md  ← 如 AGENTS.md 中有版本管理规则
  □ code-standards-rules.md      ← 如 AGENTS.md 中有代码规范规则

【待注入】加载链
  □ AGENTS.md → 强制加载 .agents/rules/
  □ CLAUDE.md → @AGENTS.md（如不存在）
```

#### 5b. Offer Customization Actions

For each item, the user can say:

| 用户指令 | 处理方式 |
|---------|---------|
| "保留 xxx" | Skip deletion, keep the skill/rules as-is where it is |
| "删除 xxx" | Remove from the install/migrate list entirely |
| "只安装 xxx 和 yyy" | Prune the list to only the named items |
| "这个不需要" | Remove that specific item |
| "先安装全部，再手动清理" | Skip confirmation, proceed with full plan |

#### 5c. Apply User Choices

After the user confirms (with or without modifications), proceed with the approved list. Skip items the user rejected. Record skipped items in INDEX.md as "用户选择跳过".

### 6. Handle Conflicts

| Conflict | Action |
|---|---|
| Same name, different version | Ask: keep old / install new / keep both (rename) |
| Functional overlap | Ask user to pick one |
| Dependency conflict | Auto-select compatible version or report |

### 7. Install & Migrate

- Move migratable skills into `.agents/skills/<name>/SKILL.md`
- Keep self-managed tool dirs untouched
- Install new skills from upstream repos into `.agents/skills/`
- Record migration history (原位置 → 新位置) in INDEX.md

### 8. Clean Up Old Dirs

Delete `.trae/skills/`, `skills/`, `.skills/` **only if** all content has been migrated and no self-managed tools remain.

### 9. MCP Dependency Resolution

For each skill that declares MCP tool requirements:

1. **Check available MCPs** — scan the IDE / tool config (`.mcp.json`, MCP config files, connected MCP servers) for a matching capability. If found → **done**, no further action needed.
2. **No MCP found?** — ask the user: "技能 xxx 需要 Y 能力，当前环境没有对应的 MCP 服务。是否需要安装 CLI 工具替代？"
   - 用户同意 → 按优先级找：官方 CLI → 社区 CLI 包装器 → HTTP API → 等效 CLI 工具
   - 用户拒绝 → 记录到 INDEX.md 作为 "能力缺失：xxx（用户选择不安装替代工具）"

### 10. Generate INDEX.md

List all installed skills with purpose, source, version, and migration notes.

---

## Upgrade Flow

1. Compare installed versions against upstream repos
2. Identify new applicable skills (based on current tech stack)
3. **Present upgrade plan** to the user as a checklist (same format as 5a), with:
   - Skills that will be updated
   - New skills that will be installed
   - Skills that will be removed (if upstream dropped them)
   - Whether rules will be overwritten or merged
4. Let user customize: "保留旧版", "这个不更新", "只更新 xxx" etc.
5. Download updates; merge custom rules (do NOT overwrite user customizations)
6. Update INDEX.md; clean up obsolete entries

## Uninstall Flow

1. Confirm skill name
2. Remove from `.agents/skills/<name>/`
3. Remove from INDEX.md
4. Check if any rule file references it; ask about cleanup

## Status Check

1. List `.agents/skills/` contents
2. Show version / source / last-updated for each
3. Verify dependency tools are installed
4. Report any unmigrated skills (excluding self-managed dirs)
