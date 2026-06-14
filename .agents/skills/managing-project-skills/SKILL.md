---
name: managing-project-skills
description: Use when the user asks to install, update, upgrade, uninstall, or check status of project skills and rules, or when setting up skills for a new project
---

# Managing Project Skills

## Overview

Orchestration entry point for project skill management. Dispatches to the appropriate sub-skill based on the user's intent.

## First-Load Detection

### 1. Check INDEX.md
If **`.agents/skills/INDEX.md` is missing or empty**, the project has not yet run skill installation.

### 2. Check for Unextracted Rules
If INDEX.md exists, check AGENTS.md and CLAUDE.md for version management or code standards rules that should have been extracted to `.agents/rules/`.

Look for these patterns in AGENTS.md/CLAUDE.md:

| Rule type | Detection keywords | Expected location |
|-----------|-------------------|------------------|
| 版本管理 | 版本管理、版本更新、版本号、versioning、changelog、更新日志 | `.agents/rules/version-management-rules.md` |
| 代码规范 | 代码规范、编码规范、提交规范、code style、commit convention | `.agents/rules/code-standards-rules.md` |

If patterns found but rule files missing, warn the user:
> "检测到 AGENTS.md/CLAUDE.md 中包含版本管理/代码规范规则，但未提取到 `.agents/rules/`。建议运行 `npx le-skills install --yes` 来自动提取。"

### 3. Bootstrap hint
If INDEX.md missing, print:
> "检测到技能尚未安装。在 IDE 中输入「安装技能和规则」即可自动扫描项目并安装匹配的技能。"
> 或运行 `node scripts/bootstrap.js` 查看项目检测报告和引导信息

### 4. Proceed
Then proceed to [installing-project-skills] when the user confirms.

## Dispatch Logic

| User intent | Sub-skill to load |
|---|---|
| "安装技能和规则" / "setup skills" / 首次项目配置 | [installing-project-skills] — full install flow（也可先运行 `node scripts/bootstrap.js` 查看项目检测报告） |
| "更新技能" / "升级技能" / "同步技能" | [installing-project-skills] — upgrade flow（也可先运行 `npx le-skills install --preview` 查看更新计划） |
| "卸载技能 xxx" | [installing-project-skills] — uninstall flow |
| "查看技能" / "技能状态" | [installing-project-skills] — status check |
| 技能执行时编排任务 | [scheduling-project-skills] |
| "更新更新日志为 vx.x.x" | [generating-changelogs] |
| "版本管理规则" / "版本规范" / "版本号" | 检查 `.agents/rules/version-management-rules.md` 是否存在，缺失则提示安装 |

## Cross-references

- **REQUIRED SUB-SKILL:** [installing-project-skills] — lifecycle management
- **REQUIRED SUB-SKILL:** [scheduling-project-skills] — task orchestration
- **REQUIRED SUB-SKILL:** [generating-changelogs] — changelog generation
- **REQUIRED RULES:** `.agents/rules/version-management-rules.md` — 版本管理（缺失时提示）
- **REQUIRED RULES:** `.agents/rules/code-standards-rules.md` — 代码规范（缺失时提示）
