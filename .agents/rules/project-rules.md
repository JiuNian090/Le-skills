# 项目通用规则

> 全量加载 — 每次对话开始时自动注入

## 代码规范

- 遵循项目已有代码风格（由 linters/formatters 强制执行）
- 提交消息优先使用 Conventional Commits（feat:/fix:/docs:/refactor:）

## 技能使用

- 优先使用 `.agents/skills/` 下的项目级技能
- 复杂任务先拆解再执行
- 多技能任务执行后必须汇总结果

## 架构约束

- 新增依赖前检查是否与现有技术栈兼容
- 不引入不必要的构建工具或框架
