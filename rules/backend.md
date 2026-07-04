# 后端工程规范（通用，分层架构）

> 由 Go 服务规范抽取的**通用可复用**规则（去业务专有）。分层思想对多数语言通用（Go/Gin 为示例）。

## 1. 分层
`config`（配置/路由/统一响应，禁业务）→ `controller`（HTTP 输入输出，禁业务逻辑，委托 service）→ `service`（全部业务逻辑、数据处理、外部命令、状态管理）。
- controller 不写业务；service 不碰 HTTP 上下文（如 gin.Context）；每个 Controller 对应一个 Service。

## 2. 技术选型（示例基线）
语言 Go｜Web 框架 Gin｜配置 Viper｜日志 log/slog（标准库）｜WebSocket gorilla/websocket。

## 3. API 设计
统一响应 `{code, message, data}`；RESTful（GET 查询/POST 创建/PUT 更新/DELETE 删除）；按模块分组路由。

## 4. 错误与日志
Recovery 中间件捕获 panic；service 返回 error、controller 转 HTTP 响应；用结构化日志（slog）**禁 printf 风格**；语义化 HTTP 状态码（400/404/500/503）。

## 5. 并发与资源
长任务用协程异步 + channel 通信 + 优雅关闭；退出时清理资源（停后台任务、Shutdown）；WebSocket 心跳/超时/连接池清理。

## 6. 安全
CORS 中间件；所有用户输入校验、防路径遍历、限制文件大小数量；不硬编码密钥、敏感配置走环境变量、`.gitignore` 排除敏感文件。

## 7. 测试与命令
service 层单测（`*_test.go`）+ 集成测试；`gofmt` 格式化；驼峰命名、导出大写开头。

## 8. AI 约束
严格分层（controller→service）；controller 不写业务、service 不碰 HTTP；新增模块同建 Controller+Service；统一响应；错误记日志+状态码；资源正确释放；不重复封装通用能力；优先标准库、避免不必要依赖；协程有明确退出机制。
