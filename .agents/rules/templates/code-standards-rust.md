<!-- psm:tech-stack-rules -->
<!-- 由 psm install 根据项目技术栈自动生成 -->

### Rust 规范

- 代码风格由 `rustfmt` + `clippy` 强制执行
- 所有公有项（`pub`）必须包含文档注释（`///` 或 `//!`）
- 错误处理：使用 `Result<T, E>` 和 `?` 运算符，避免 `unwrap()` / `expect()`（除非有明确理由）
- 所有权：优先使用引用 `&T` 而非克隆，善用借用检查器
- 并发：使用 `Send + Sync` trait 边界，优先选用 `tokio` 或 `async-std`
- 测试：单元测试放在模块内（`#[cfg(test)]`），集成测试放在 `tests/` 目录
- 依赖管理：`cargo deny` / `cargo audit` 定期检查安全漏洞
- 特性门控：可选功能使用 feature flags，避免条件编译扩散
- 使用 `thiserror` 和 `anyhow` 做分层错误处理
