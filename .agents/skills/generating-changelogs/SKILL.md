---
name: generating-changelogs
description: Use when the user says "更新更新日志为 vx.x.x" or "update changelog" or any request to generate or update a CHANGELOG.md from git history
---

# Generating Changelogs

## Overview

Collects commits since the last tag, classifies them by type, and writes a formatted CHANGELOG.md entry.

## Trigger

User says: "更新更新日志为 vx.x.x" or equivalent.

## Flow

### 1. Collect Commits

```bash
# Get the last tag
git describe --tags --abbrev=0
# Get commits since that tag
git log <last-tag>..HEAD --oneline
```

### 2. Classify by Type

| Category | Emoji | Keywords |
|---|---|---|
| New feature | 🎉 新增 | feat:, feature, 新增, add |
| UX polish | ✨ 优化 | improve, optimize, enhance, perf |
| Bug fix | 🔧 修复 | fix:, bug, patch, 修复 |
| Config | ⚡ 调整 | config, setting, param, env |
| Refactor | 🏗️ 重构 | refactor:, restructure, 重构 |
| Documentation | 📊 文档 | docs:, doc, readme, 文档 |
| Style | 🎨 样式 | style, css, ui, theme, 样式 |

Use conventional commit prefixes when available; otherwise infer from message semantics.

### 3. Output Format

```markdown
## v{x.y.z} - {YYYY-MM-DD}

### 🎉 新增
- Feature 1
- Feature 2

### ✨ 优化
- Improvement 1
```

### 4. Version Bump

Update version in: `package.json`, `pyproject.toml`, `VERSION`, and CHANGELOG.md header.

### 5. CHANGELOG.md Location

- Prepend to existing `CHANGELOG.md` in project root
- Create one if none exists
