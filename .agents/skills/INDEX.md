# 技能树 INDEX

> 🎯 **任何 AI Agent / AI IDE 的统一导航入口** — 安装后优先读取此文件了解技能结构
> 由 psm install 自动生成 — 运行 `npx psm install --yes` 重新生成

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

## 🧭 导航指南（任何 Agent 通用）

### 1. 用户发来消息 → 2. 匹配 L1 类别 → 3. 加载 L2 技能

| 用户说/场景 | → 匹配 L1 | → 加载 L2 技能 |
|------------|----------|---------------|
| "安装技能和规则" / "setup skills" | 🔧 生命周期管理 | `installing-project-skills` |
| "更新/升级/卸载技能 xxx" | 🔧 生命周期管理 | `installing-project-skills` |
| "查看技能" / "技能状态" | 🔧 生命周期管理 | `installing-project-skills` |
| 多技能编排/判断难度/复杂任务 | 📋 任务调度 | `scheduling-project-skills` |
| "更新更新日志为 vx.x.x" | 📦 版本发布 | `generating-changelogs` |
| "版本管理" / "版本规范" | 📦 版本发布 | 检查 `version-management-rules.md` |

> **调用方式：** 任何 Agent 读取此表后，根据用户输入匹配第二列 L1 类别，然后直接读取 L2 对应的 SKILL.md 文件并执行。

---

## 📂 文件索引

| 文件 | 树路径 | 用途 |
|------|-------|------|
| `managing-project-skills/SKILL.md` | `root` | 根节点，L0 入口调度 |
| `installing-project-skills/SKILL.md` | `lifecycle/install` | L2，安装/更新/卸载/查看 |
| `scheduling-project-skills/SKILL.md` | `schedule/orchestrate` | L2，编排/调度/难度分级 |
| `generating-changelogs/SKILL.md` | `release/changelog` | L2，更新日志生成 |

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

## 相关工具

| 工具 | 用途 | 位置 |
|------|------|------|
| `bootstrap.js` | 跨平台项目检测 + 技能安装状态 + 引导提示 | `scripts/bootstrap.js` |
| `bootstrap.sh` | Linux/macOS 版项目检测 | `scripts/bootstrap.sh` |

> **注意：** 本 INDEX.md 由 psm 维护。任何 AI IDE（Cursor / Windsurf / Trae / Claude Code / GitHub Copilot）均可通过读取此文件理解技能树结构。
