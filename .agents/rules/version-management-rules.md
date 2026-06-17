<!-- psm:auto-generated version=1.0 -->
<!-- 本文件由 psm install 生成。安装时如检测到 AGENTS.md/CLAUDE.md 有版本管理规则，会提取到此文件 -->

# 版本管理规则

> 按需加载 — 用户说「更新更新日志为 vx.x.x」「发布新版本」「打 tag」时加载
> 关联技能：`generating-changelogs`

---

## 概述

本规则定义了项目的版本更新流程，包括 CHANGELOG 生成、版本号更新和发布流程。

---

## 🎯 触发条件

| 用户指令 | 触发动作 | 加载的规则/技能 |
|---------|---------|---------------|
| 「更新更新日志为 vx.x.x」 | 加载本文件 + 调用 `generating-changelogs` | 全量 |
| 「发布新版本」「打 tag」「release」 | 版本号更新 + CHANGELOG + git tag | 按需 |
| 「查看版本历史」「changelog」 | 读取 CHANGELOG.md | 按需 |

---

## 🔄 默认流程（由 generating-changelogs 技能执行）

### 1. 收集提交

```bash
git describe --tags --abbrev=0          # 获取上一个 tag
git log <last-tag>..HEAD --oneline      # 获取期间提交
```

### 2. 按类型分类

| 分类 | emoji | 关键词 |
|------|-------|--------|
| 新功能 | 🎉 新增 | feat:, feature, 新增, add |
| 体验优化 | ✨ 优化 | improve, optimize, enhance, perf |
| Bug 修复 | 🔧 修复 | fix:, bug, patch, 修复 |
| 配置调整 | ⚡ 调整 | config, setting, param, env |
| 代码重构 | 🏗️ 重构 | refactor:, restructure, 重构 |
| 文档图表 | 📊 文档 | docs:, doc, readme, 文档 |
| 样式调整 | 🎨 样式 | style, css, ui, theme, 样式 |

### 3. 输出格式

```markdown
## v{x.y.z} - {YYYY-MM-DD}

### 🎉 新增
- 功能点 1

### ✨ 优化
- 优化点 1
```

### 4. 版本号更新

更新 `package.json`、`pyproject.toml`、`VERSION` 等文件中的版本号。

### 5. CHANGELOG.md

默认在项目根目录。已有则追加到最上方，没有则创建。

---

## ⚠️ 冲突处理

> 以下场景由 psm install 检测并交互处理

| 检测到的冲突 | 处理方式 |
|------------|---------|
| AGENTS.md 已有版本管理章节（"版本管理规则""版本更新""Versioning"） | 询问：提取到本文件并替换为引用 / 保留原有 / 合并 |
| CHANGELOG.md 已有不同格式 | 询问：使用 psm 格式 / 保留现有格式 |
| 项目已有 `npm version` / `standard-version` 等工具 | 询问：集成到流程 / 跳过 |

---

## 📝 项目自定义

<!-- psm:project-custom -->
<!-- 安装后，项目专属的版本管理规则（如特殊版本号格式、发布流程）写在此处 -->
