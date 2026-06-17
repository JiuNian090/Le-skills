<!-- psm:tech-stack-rules -->
<!-- 由 psm install 根据项目技术栈自动生成 -->

### Go 规范

- 代码风格由 `gofmt` / `go vet` 强制执行，无需额外配置
- 错误处理：始终显式检查 `err != nil`，避免忽略错误
- 使用 `errors.Is()` / `errors.As()` 进行错误链比较
- 接口设计：小接口（≤3 方法），接受接口返回结构体
- 并发：使用 `sync.WaitGroup` / `errgroup` 管理 goroutine，避免泄露
- 测试：标准 `testing` 包，使用 `testify/assert` 辅助断言
- 依赖管理：使用 Go modules，定期 `go mod tidy`
- 上下文（context）：所有阻塞/网络操作接受 `context.Context` 作为第一个参数
- 日志：使用结构化日志（`slog` / `zerolog` / `zap`），避免 `fmt.Println`
