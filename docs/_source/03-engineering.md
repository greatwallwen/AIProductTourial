## 4. 工程规范与代码约束

![工程规范与代码约束](outputs/product_case_library/svg/fig_engineering_rules.svg)

> 既是本教程的工程原理，也真实约束本仓库代码，并被 `verify_course_package.mjs` 守护。全文规范沉淀在 `rules/`（对齐 Google Style Guides、swe-book、Conventional Commits、OWASP 等，见 `rules/references.md`）。

### 4.1 复用优先
#### 4.1.1 成熟方案
#### 4.1.2 避免重复
#### 4.1.3 最小改动

```备注
优先调研成熟稳定的开源库，不重复造轮子；两处以上可复用逻辑抽离为公共模块（DRY）；优先在现有代码上扩展而非推倒重写、保持 API 兼容、改动范围最小化。见 rules/ai-dev-constraints.md 第 1/4/10 条。
```

### 4.2 结构清晰
#### 4.2.1 组件拆分
#### 4.2.2 目录规范
#### 4.2.3 分层架构

```备注
按功能拆分、单一职责，页面组织业务而不实现所有细节；新增代码遵循既定目录、不随意加顶级目录、工具/组件/接口/类型不混放；后端分层 controller→service，controller 不写业务、service 不碰 HTTP 上下文。见 rules/ai-dev-constraints.md 第 2/3 条与 rules/backend.md。
```

### 4.3 代码质量
#### 4.3.1 简洁<800行
#### 4.3.2 类型安全
#### 4.3.3 中文注释

```备注
可读性优先于炫技，一个函数只做一件事，不留废弃代码/调试输出；**单文件 < 800 行**，超出即拆分；优先 TS 类型、避免大量 any；统一中文注释，重点写"为什么这样做"与业务规则，复杂函数（约 30 行以上）前加整体思路。见 rules/ai-dev-constraints.md 第 5/6/7 条。
```

### 4.4 健壮与安全
#### 4.4.1 错误处理
#### 4.4.2 性能意识
#### 4.4.3 安全红线

```备注
所有异步请求做异常处理、不忽略 Promise 错误、用户可感知错误给明确提示；按需加载、避免不必要重复渲染；输入校验、防路径遍历、不硬编码密钥、敏感配置走环境变量。见 rules/ai-dev-constraints.md 第 8/9 条与 rules/backend.md 安全节（OWASP Top 10）。
```

### 4.5 前端规范
#### 4.5.1 Monorepo
#### 4.5.2 微前端
#### 4.5.3 公共沉淀

```备注
Monorepo（pnpm workspace）+ 微前端（qiankun）：shell 只做入口不写业务、业务放各子应用；公共能力沉淀 packages/（ui/theme/auth/request/utils），不重复封装请求/认证/主题；VITE_ 环境变量、独立构建。见 rules/frontend.md。
```

### 4.6 后端规范
#### 4.6.1 统一响应
#### 4.6.2 结构化日志
#### 4.6.3 优雅退出

```备注
统一响应 {code,message,data}、RESTful、按模块分组路由；结构化日志（slog）禁 printf 风格、语义化状态码；长任务用协程+channel、退出时清理资源、WebSocket 心跳超时。见 rules/backend.md。
```
