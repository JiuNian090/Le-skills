# Le-Skills

[![npm version](https://img.shields.io/npm/v/le-skills?color=blue)](https://www.npmjs.com/package/le-skills)
[![npm downloads](https://img.shields.io/npm/dm/le-skills?color=blue)](https://www.npmjs.com/package/le-skills)
[![license](https://img.shields.io/npm/l/le-skills?color=green)](LICENSE)

作者自建使用的 AI Agent Skills & Rules 集合。**一行命令安装到任何项目**，自动匹配技术栈、生成规则文件。

---

## 快速安装

```bash
npx le-skills install
```

安装到其他目录：

```bash
npx le-skills install ../my-project
```

## CLI 命令参考

| 命令 | 作用 |
|------|------|
| `npx le-skills install [-y] [target]` | 安装技能和规则到目标项目 |
| `npx le-skills check [target]` | 检测安装状态并展示报告 |
| `npx le-skills info [target]` | 显示版本、环境、安装详情 |
| `npx le-skills list` | 显示当前包中包含的技能清单 |
| `npx le-skills outdated` | 检查 npm 是否有新版本 |
| `npx le-skills update` | 自更新到最新版本 |
| `npx le-skills version` | 显示版本号 |
| `npx le-skills help` | 显示帮助 |

### 选项

| 选项 | 说明 |
|------|------|
| `-y, --yes` | 静默模式，覆盖已安装的内容（用于 CI/脚本） |

## 安装到项目（其他方式）

### 方式一：npx（推荐）

```bash
npx le-skills install
```

无需全局安装，零依赖，自动下载并运行。

### 方式二：Git 子目录复制

```bash
git clone --depth 1 https://github.com/JiunianTV/Le-Skills.git .le-skills-tmp
cp -r .le-skills-tmp/.agents ./your-project/
cp -r .le-skills-tmp/scripts ./your-project/
rm -rf .le-skills-tmp
```

### 方式三：Git subtree（跟踪上游更新）

```bash
git subtree add --prefix=.le-skills \
  https://github.com/JiunianTV/Le-Skills.git main --squash
ln -sf .le-skills/.agents .agents
ln -sf .le-skills/scripts scripts
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
Le-Skills/
├── bin/
│   └── le-skills.js              # CLI 入口（npm 发布）
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
  - run: npx le-skills check   # 使用 npx
  - run: bash scripts/bootstrap.sh --check  # 或直接使用脚本
```

技能未安装时 exit 1，已就绪 exit 0。

## 发布到 npm

### 首次发布前配置

npm 现已推荐使用 **Trusted Publishing**（基于 OIDC），无需管理任何 token。

**配置 Trusted Publishing（一次性的，在 npm 官网操作）：**

1. 打开 https://www.npmjs.com/settings/jiunian090/packages （或你的包管理页面）
2. 搜索你的包 `le-skills`，点进去
3. 找到 **Access** → 点 **Manage CI/CD** → 你会看到 **Trusted Publishing** 选项
4. 选择 **GitHub Actions**
5. 填入：
   - **GitHub Owner:** `JiuNian090`
   - **GitHub Repo:** `Le-skills`
   - **Environment:** 留空（或选 main）
6. 点 **Save**

> 不同 npm 版本的界面可能略有差异，核心就是配置 npm 信任 `JiuNian090/Le-skills` 这个仓库的 GitHub Actions OIDC 身份。

**验证发布：**

```bash
git tag v1.0.0
git push origin main --tags
```

GitHub Actions 会自动触发 `npm publish --provenance`，无需任何 token 或密钥。前往 https://github.com/JiuNian090/Le-skills/actions 查看状态。

如果之前创建过 `NPM_TOKEN` 的 GitHub Secret，现在可以删掉它，不再需要了。

## 开源协议

MIT
