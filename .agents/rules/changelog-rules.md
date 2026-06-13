# 更新日志规则

> 按需加载 — 用户说"更新更新日志为 vx.x.x"时加载

## 流程

1. 获取上一个 tag 到最新提交的 commit
2. 按提交类型分类（feat/fix/docs/refactor/style/perf/config）
3. 按格式输出到 CHANGELOG.md
4. 更新所有版本号相关文件

## 分类标准

| 分类 | emoji | 关键词 |
|------|-------|--------|
| 新功能 | 🎉 新增 | feat:, feature, 新增, add |
| 体验优化 | ✨ 优化 | improve, optimize, enhance, perf |
| bug 修复 | 🔧 修复 | fix:, bug, patch, 修复 |
| 配置调整 | ⚡ 调整 | config, setting, param, env |
| 代码重构 | 🏗️ 重构 | refactor:, restructure, 重构 |
| 文档图表 | 📊 文档 | docs:, doc, readme, 文档 |
| 样式调整 | 🎨 样式 | style, css, ui, theme, 样式 |

## 输出格式

```markdown
## v{x.y.z} - {YYYY-MM-DD}

### 🎉 新增
- 功能点 1

### ✨ 优化
- 优化点 1
```

## CHANGELOG.md

默认在项目根目录。已有则追加到最上方，没有则创建。
