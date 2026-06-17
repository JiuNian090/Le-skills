<!-- psm:tech-stack-rules -->
<!-- 由 psm install 根据项目技术栈自动生成 -->

### Python 规范

- 遵循 PEP 8 编码风格（行长度 88 字符，Black 格式化）
- 所有函数和类必须包含类型注解（PEP 484）
- 使用 `pathlib` 替代 `os.path` 处理路径
- 错误处理：使用特定异常类，避免裸 `except:`
- 异步代码使用 `asyncio` / `anyio`，避免 `sync_to_async` 包装
- 导入顺序：标准库 → 第三方 → 本地模块（isort 分组）
- 测试框架：pytest，测试覆盖率 ≥ 80%
- 代码风格由 Black + Ruff 强制执行
- 依赖管理：使用 `pyproject.toml`，定期 `pip audit`
- 类型检查：使用 `mypy` 或 `pyright` 严格模式
