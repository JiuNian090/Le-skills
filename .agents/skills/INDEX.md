# 技能清单 INDEX

> 由 le-skills install 自动生成 — 运行 `npx le-skills install --yes` 重新生成

## 已安装技能

| 技能 | 用途 | 调度优先级 |
|------|------|-----------|
| [managing-project-skills](./managing-project-skills/SKILL.md) | 技能管理入口调度，根据用户意图分派到子技能 | ⭐ 最高（入口） |
| [installing-project-skills](./installing-project-skills/SKILL.md) | 技能安装/升级/卸载/状态检查全生命周期 | ⭐ 高 |
| [scheduling-project-skills](./scheduling-project-skills/SKILL.md) | 难度分级、场景映射、技能编排调度 | ⭐ 中 |
| [generating-changelogs](./generating-changelogs/SKILL.md) | 从 git commit 生成格式化 CHANGELOG.md | ⭐ 中 |

## 依赖规则

| 规则文件 | 加载方式 |
|---------|---------|
| `.agents/rules/project-rules.md` | 全量加载 |
| `.agents/rules/skill-scheduling-rules.md` | 按需加载 |
| `.agents/rules/version-management-rules.md` | 按需加载（触发式） |
| `.agents/rules/code-standards-rules.md` | 按需加载（触发式） |
| `.agents/rules/changelog-rules.md` | 按需加载 |
| `.agents/rules/skill-lifecycle-rules.md` | 按需加载 |

## ⚡ 按需加载决策表（Agent 执行指南）

每次收到用户消息后，按以下规则决定是否加载额外规则文件：

| 触发条件 | 操作 | 加载方式 |
|---------|------|---------|
| 用户说「更新更新日志」「发布」「打 tag」 | 读取 `version-management-rules.md` 并应用 | 按需加载 |
| 用户说「修改代码」「新增」「提交代码」 | 读取 `code-standards-rules.md` 检查规范 | 按需加载 |
| 用户说「安装/更新/卸载技能」 | 读取 `skill-lifecycle-rules.md` 执行生命周期 | 按需加载 |
| 技能执行时编排任务 | 读取 `skill-scheduling-rules.md` 决定调度策略 | 按需加载 |
| 用户说「更新更新日志为 vx.x.x」 | 读取 `changelog-rules.md` 生成更新日志 | 按需加载 |
| 未匹配以上条件 | 仅使用 `project-rules.md`（已全量加载） | 全量加载 |

## 相关工具

| 工具 | 用途 | 位置 |
|------|------|------|
| `bootstrap.js` | 跨平台项目检测 + 技能安装状态 + 引导提示 | `scripts/bootstrap.js` |
| `bootstrap.sh` | Linux/macOS 版项目检测（需要 bash） | `scripts/bootstrap.sh` |

> **注意：** 本 INDEX.md 由 le-skills 维护。安装时自动生成，编辑自定义内容请放在对应的规则文件项目自定义区域（`<!-- le-skills:project-custom -->`）。
