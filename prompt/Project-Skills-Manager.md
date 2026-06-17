# PSMgr (Project Skills Manager)

> **本项目是 PSM 技能包的源仓库。** 技能定义和规则以 `.agents/` 目录为单一数据源。
> 安装到目标项目后，Agent 应直接读取目标项目中的 `.agents/skills/INDEX.md` 获取技能树。

---

## 📖 快速导航

| 你想做什么 | 去看什么 |
|-----------|---------|
| 了解技能树结构 | `.agents/skills/INDEX.md` — L0→L1→L2 分层调度表 |
| 安装/升级/卸载技能 | `.agents/skills/installing-project-skills/SKILL.md` |
| 编排多技能任务 | `.agents/skills/scheduling-project-skills/SKILL.md` |
| 生成更新日志 | `.agents/skills/generating-changelogs/SKILL.md` |
| 查看全量规则 | `.agents/rules/project-rules.md` |
| 查看调度规则 | `.agents/rules/skill-scheduling-rules.md` |
| 查看生命周期规则 | `.agents/rules/skill-lifecycle-rules.md` |
| 安装 CLI 工具 | `npx psmgr install` |
| 管理工具依赖 | `.agents/tools.json` + `npx psmgr tool list/install/verify` |

---

## ⚡ 核心原则

1. **技能树驱动** — Agent 先读 INDEX.md 匹配 L1 类别，再加载 L2 技能执行
2. **按需加载** — `.agents/rules/` 下的规则文件仅在匹配触发条件时加载
3. **项目内优先** — `.agents/skills/` 下的技能优先于全局技能
4. **注册中心** — 技能源由 `.agents/skills-registry.json` 管理，可扩展

---

> 🔗 完整文档见 `.agents/skills/INDEX.md`
