---
name: scheduling-project-skills
description: Use when orchestrating multiple skills for a task — determining execution order, parallelism, and difficulty grading. Also use when the user asks how skills are dispatched
---

# Scheduling Project Skills

## Overview

Defines how skills are selected, ordered, and executed: difficulty grading (L1-L4), scenario-to-skill mapping, and serial/parallel orchestration.

## Difficulty Grading

| Level | Difficulty | Max parallel skills | Examples |
|---|---|---|---|
| L1 | Simple | 1 | Translation, formatting, simple fixes |
| L2 | Medium | 2 | Feature implementation, unit tests |
| L3 | Complex | 3 | Architecture design, multi-module coordination |
| L4 | Expert | 5 | Performance audit, security review, deep refactor |

**L3/L4 special rule:** If `brainstorming` skill is installed, call it first to decompose the task before dispatching other skills.

## Scenario-to-Skill Mapping

| Scenario | Keywords | Pipeline | Mode |
|---|---|---|---|
| New feature | "实现" "添加功能" | code-gen → style-check → test | Serial |
| Refactor | "重构" "优化代码" | code-understand → refactor → verify | Serial |
| Testing | "测试" "测试用例" | test-gen → coverage-check | Serial |
| Code review | "审查" "review" | analyze → report | Parallel |
| Bug fix | "报错" "bug" | log-analyze → locate → fix | Serial |
| Performance | "慢" "性能" | profile → bottleneck → optimize | Serial |
| Build/deploy | "构建" "发布" "deploy" | build-check → version → deploy | Serial |
| Config/CI/CD | "配置" "CI" "CD" | env-detect → config-gen → verify | Parallel |
| Documentation | "文档" | code-understand → doc-gen → format-check | Serial |
| Changelog | "更新日志" "changelog" | commit-collect → classify → format | Serial |

## Skill Selection Priority

1. **Project-local first:** `.agents/skills/` over global skills
2. **Specialized over generic:** e.g. `vue-skill` before `frontend-generic`
3. **Higher version over lower:** same-function skills
4. **CLI over MCP:** prefer CLI tools over MCP server calls

## Orchestration Patterns

| Complexity | Pattern | Example |
|---|---|---|
| L1 | Single skill, direct execution | Translate a string |
| L2 | Main + helper, serial | Implement login → write tests → security check |
| L3 | Parallel + merge | Understand code + check coverage + analyze deps → merge → plan → refactor |
| L4 | Multi-agent + cross-verify | Coordinator dispatches sub-agents, results cross-checked |

## Pre-execution Checklist

- [ ] Task type identified
- [ ] Difficulty assessed
- [ ] Relevant skills installed
- [ ] Dependency tools available
- [ ] Call order correct (prerequisites first)
- [ ] Results verified
- [ ] Multi-skill output merged
