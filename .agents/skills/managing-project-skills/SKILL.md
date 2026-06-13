---
name: managing-project-skills
description: Use when the user asks to install, update, upgrade, uninstall, or check status of project skills and rules, or when setting up skills for a new project
---

# Managing Project Skills

## Overview

Orchestration entry point for project skill management. Dispatches to the appropriate sub-skill based on the user's intent.

## First-Load Detection

If this skill is loaded and **`.agents/skills/INDEX.md` is missing or empty**, the project has not yet run skill installation. In that case:

1. **Print a bootstrap hint** to the user:
   > "检测到技能尚未安装。在 IDE 中输入「安装技能和规则」即可自动扫描项目并安装匹配的技能。"
2. **Refer to the bootstrap script** if user prefers CLI:
   > 或运行 `bash scripts/bootstrap.sh` 查看项目检测报告和引导信息
3. Then proceed to [installing-project-skills] when the user confirms.

## Dispatch Logic

| User intent | Sub-skill to load |
|---|---|
| "安装技能和规则" / "setup skills" / 首次项目配置 | [installing-project-skills] — full install flow（也可先运行 `bash scripts/bootstrap.sh` 查看项目检测报告） |
| "更新技能" / "升级技能" / "同步技能" | [installing-project-skills] — upgrade flow |
| "卸载技能 xxx" | [installing-project-skills] — uninstall flow |
| "查看技能" / "技能状态" | [installing-project-skills] — status check |
| 技能执行时编排任务 | [scheduling-project-skills] |
| "更新更新日志为 vx.x.x" | [generating-changelogs] |

## Cross-references

- **REQUIRED SUB-SKILL:** [installing-project-skills] — lifecycle management
- **REQUIRED SUB-SKILL:** [scheduling-project-skills] — task orchestration
- **REQUIRED SUB-SKILL:** [generating-changelogs] — changelog generation
