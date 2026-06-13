# 技能清单 INDEX

> 自动生成 — 记录所有已安装技能及其用途

## 已安装技能

| 技能 | 用途 | 调度优先级 | 来源 |
|------|------|-----------|------|
| [managing-project-skills](./managing-project-skills/SKILL.md) | 技能管理入口调度，根据用户意图分派到子技能 | ⭐ 最高（入口） | 源自 `prompt/Project-Skills-Manager.md` |
| [installing-project-skills](./installing-project-skills/SKILL.md) | 技能安装/升级/卸载/状态检查全生命周期 | ⭐ 高 | 同上 |
| [scheduling-project-skills](./scheduling-project-skills/SKILL.md) | 难度分级、场景映射、技能编排调度 | ⭐ 中 | 同上 |
| [generating-changelogs](./generating-changelogs/SKILL.md) | 从 git commit 生成格式化 CHANGELOG.md | ⭐ 中 | 同上 |

## 相关工具

| 工具 | 用途 | 位置 |
|------|------|------|
| `bootstrap.sh` | 一键检测项目类型 + 技能安装状态 + 引导提示 | `scripts/bootstrap.sh` |

## 依赖规则

| 规则文件 | 加载方式 | 关联技能 |
|---------|---------|---------|
| `.agents/rules/skill-lifecycle-rules.md` | 按需 | installing-project-skills |
| `.agents/rules/skill-scheduling-rules.md` | 按需 | scheduling-project-skills |
| `.agents/rules/changelog-rules.md` | 按需 | generating-changelogs |
| `.agents/rules/project-rules.md` | 全量 | 所有技能 |

## 迁移记录

| 原位置 | 新位置 | 说明 |
|-------|-------|------|
| `prompt/Project-Skills-Manager.md` | 拆分为以上 4 个技能 + 4 个规则 | 保留原文件作为源文档 |

> **注意：** 本 INDEX.md 由技能管理器维护，安装/升级/卸载后自动更新。
