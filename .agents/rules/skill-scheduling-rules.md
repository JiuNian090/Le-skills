<!-- le-skills:auto-generated version=1.0 -->
<!-- 本文件由 le-skills install 生成 -->

# 技能调度规则

> 按需加载 — 技能执行任务时加载

---

## 调度原则

1. **项目内技能优先：** 先使用 `.agents/skills/` 下的技能，再考虑全局技能
2. **按需加载：** 仅加载当前任务相关的技能
3. **单一职责：** 每个技能只执行单一任务
4. **串行优先：** 同类型任务串行执行
5. **Brainstorming 优先（如有）：** L3/L4 复杂任务先调 brainstorming 分析拆解

---

## 🎯 触发条件矩阵

| # | 场景 | 用户触发词 | 调用链 | 说明 |
|---|------|-----------|--------|------|
| 1 | 新功能开发 | "实现""添加""新增功能" | `brainstorming` → `writing-plans` → `codegraph/gitnexus` → `tdd` → 验证 | 从设计到实现 |
| 2 | Bug 修复 | "报错""bug""不工作""出错" | `systematic-debugging` → `test-driven-development` → 验证 | 先诊断再修复 |
| 3 | 代码重构 | "重构""优化代码""重写" | `codegraph/gitnexus`(影响分析) → `writing-plans` → `tdd` → 验证 | 改前分析影响范围 |
| 4 | 代码审查 | "审查""review""检查代码" | `codegraph/gitnexus` → `requesting-code-review` → 验证 | 分析变更影响 |
| 5 | 安全审查 | "安全审查""安全检查""security" | `codegraph impact` → `security-review` → 验证 | ECC 安全协议 |
| 6 | 技术调研 | "调研""怎么看""查一下" | `search-first` → `writing-plans` → 编码 | 先找现成方案 |
| 7 | UI/UX 设计 | "设计""改界面""新页面" | `brainstorming` → 设计技能 → 实现 → 验证 | 参考设计技能选择指南 |
| 8 | E2E 验证 | "验证""测试流程""e2e" | `e2e-testing` → `verification-before-completion` | 核心链路验证 |
| 9 | 性能优化 | "性能""优化""太慢" | `web-perf` → `codegraph/gitnexus` → `writing-plans` → 验证 | 先测量再优化 |
| 10 | API/外部集成 | "接入""API""集成" | `search-first` → `codegraph` → `tdd`(mock) → 验证 | 调研→实现 |
| 11 | 版本发布 | "发布""新版本""更新日志" | `generating-changelogs` → 版本号更新 → git tag | 加载 version-management-rules.md |
| 12 | 技能管理 | "安装技能""更新技能""卸载" | `managing-project-skills` → 对应子技能 | 加载 skill-lifecycle-rules.md |

---

## 难度分级

| 级别 | 最大并行 | 典型任务 |
|------|---------|---------|
| L1 | 1 | 翻译、格式化、简单修复 |
| L2 | 2 | 功能实现、单元测试 |
| L3 | 3 | 架构设计、多模块协调 |
| L4 | 5 | 性能优化、安全审计、深度重构 |

## 任务难度判断

根据任务复杂度选择不同的技能组合：

```
任务开始
  ↓
判断难度
  ├─ 简单（单步操作）
  │    直接执行 + 代码规范规则
  │
  ├─ 中等（2-5 步）
  │    writing-plans → 编码 + test-driven-development → 验证
  │                                                                        ↓
  │    遇到问题 → systematic-debugging
  │
  └─ 复杂（多模块/跨文件）
       brainstorming → writing-plans → codegraph/gitnexus
            → test-driven-development → 验证
                                          ↓
                 遇到问题 → systematic-debugging
  ↓
完成任务
```

| 难度 | 判断标准 | 示例 |
|------|---------|------|
| **简单** | 单文件改动 ≤ 20 行，无逻辑分支 | 文案修改、样式调整、配置更新 |
| **中等** | 2-5 步操作，涉及单模块 | 添加一个搜索过滤条件、修改行为 |
| **复杂** | 多模块跨文件，需设计方案 | 新增搜索源、重构核心模块、性能优化 |

---

## 技能选择优先级

项目内 > 专用技能 > 高版本 > CLI 优先于 MCP

## 编排模式

| 复杂度 | 方式 |
|--------|------|
| L1 | 单一技能直接执行 |
| L2 | 主技能 + 辅助技能串行 |
| L3 | 多技能并行 + 结果汇总 |
| L4 | 多 Agent 协作 + 交叉验证 |

---

## 并行执行原则

对于独立操作，优先使用并行调度：

```
✅ 正确：并行执行
  Agent 1：codegraph 影响分析
  Agent 2：search-first 技术调研
  Agent 3：e2e-testing 跑回归

❌ 错误：不必要的串行
  先 Agent 1、再 Agent 2、再 Agent 3
```

---

## 开发工作流

1. **规划** → `brainstorming` 或 `writing-plans`
2. **开发** → `tdd` 或直接编码（简单任务）
3. **审查** → `codegraph/gitnexus` + `requesting-code-review`
4. **安全** → `security-review`（涉及输入/API时）
5. **验证** → `verification-before-completion`
6. **提交** → 提交规范（加载 code-standards-rules.md）
