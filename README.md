# PSM (Project Skills Manager)

[![npm version](https://img.shields.io/npm/v/psm?color=blue)](https://www.npmjs.com/package/psm)
[![npm downloads](https://img.shields.io/npm/dm/psm?color=blue)](https://www.npmjs.com/package/psm)
[![license](https://img.shields.io/npm/l/psm?color=green)](LICENSE)

> **PSM** = **P**roject **S**kills **M**anager — AI Agent 技能与规则管理工具。
一行命令安装到任何项目，自动匹配技术栈、生成规则文件。

---

## 快速安装

```bash
npx psm install
```

安装到其他目录：

```bash
npx psm install ../my-project
```

## CLI 命令参考

| 命令 | 作用 |
|------|------|
| `npx psm install [-y] [target]` | 安装技能和规则到目标项目 |
| `npx psm check [target]` | 检测安装状态并展示报告 |
| `npx psm info [target]` | 显示版本、环境、安装详情 |
| `npx psm list` | 显示当前包中包含的技能清单 |
| `npx psm outdated` | 检查 npm 是否有新版本 |
| `npx psm update` | 自更新到最新版本 |
| `npx psm version` | 显示版本号 |
| `npx psm help` | 显示帮助 |

### 选项

| 选项 | 说明 |
|------|------|
| `-y, --yes` | 静默模式，覆盖已安装的内容（用于 CI/脚本） |

## 安装到项目（其他方式）

### 方式一：npx（推荐）

```bash
npx psm install
```

无需全局安装，零依赖，自动下载并运行。

### 方式二：Git 子目录复制

```bash
git clone --depth 1 https://github.com/JiunianTV/Le-Skills.git .psm-tmp
cp -r .psm-tmp/.agents ./your-project/
cp -r .psm-tmp/scripts ./your-project/
rm -rf .psm-tmp
```

### 方式三：Git subtree（跟踪上游更新）

```bash
git subtree add --prefix=.psm \
  https://github.com/JiunianTV/Le-Skills.git main --squash
ln -sf .psm/.agents .agents
ln -sf .psm/scripts scripts
```

## 安装后的下一步

```bash
# 1. 运行检测脚本
bash scripts/bootstrap.sh

# 2. 在 IDE 中输入以下指令：
#    「安装技能和规则」  — 首次安装/配置
#    「更新技能和规则」  — 升级已有技能
#    「卸载技能 xxx」    — 移除指定技能
#    「查看技能」        — 查看技能状态
#    「更新更新日志为 v1.0.0」 — 生成 CHANGELOG
```

## 目录结构

```
PSM/
├── bin/
│   └── psm.js              # CLI 入口（npm 发布）
├── .agents/
│   ├── skills/                   # 规范化技能（每个 SKILL.md 含 YAML frontmatter）
│   │   ├── INDEX.md              # 技能清单
│   │   ├── managing-project-skills/
│   │   ├── installing-project-skills/
│   │   ├── scheduling-project-skills/
│   │   └── generating-changelogs/
│   └── rules/                    # 按需加载的规则
│       ├── project-rules.md      # 全量加载 — 通用规范
│       ├── skill-lifecycle-rules.md
│       ├── skill-scheduling-rules.md
│       └── changelog-rules.md
├── scripts/
│   └── bootstrap.sh              # 自举检测脚本
├── prompt/                       # 完整版提示词（源文档）
│   ├── Flight-Translator.md
│   └── Project-Skills-Manager.md
└── package.json
```

## 规则加载机制

| 规则文件 | 加载方式 | 触发场景 |
|---------|---------|---------|
| `project-rules.md` | 全量加载 | 每次对话自动注入 |
| `skill-lifecycle-rules.md` | 按需 | 用户说安装/升级/卸载技能时 |
| `skill-scheduling-rules.md` | 按需 | 技能执行任务时 |
| `changelog-rules.md` | 按需 | 用户说更新更新日志时 |

## CI 集成

```yaml
# .github/workflows/check-skills.yml
steps:
  - run: npx psm check   # 使用 npx
  - run: bash scripts/bootstrap.sh --check  # 或直接使用脚本
```

技能未安装时 exit 1，已就绪 exit 0。

## 开源协议

MIT
