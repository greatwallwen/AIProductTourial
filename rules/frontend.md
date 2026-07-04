# 前端工程规范（通用，Monorepo + 微前端）

> 由学习平台前端规范抽取的**通用可复用**规则（去业务专有）。对齐 Vite/React/TS 生态与 shadcn/Tailwind 实践。

## 1. 架构
Monorepo（pnpm workspace）+ 微前端（如 qiankun）：统一技术栈与 UI 风格、独立开发/构建/部署、公共能力共享、降低耦合。

## 2. 技术选型（示例基线）
包管理 pnpm workspace｜框架 Vite + React + TypeScript｜路由 React Router｜微前端 qiankun｜UI shadcn/ui｜CSS Tailwind｜请求 Axios。

## 3. 目录结构
`apps/`（shell 主应用 + 各业务子应用）+ `packages/`（ui / theme / auth / request / utils）。
- **shell 只做平台入口与微前端挂载，禁止写任何业务逻辑。**
- 业务必须放各自 App，不得放入 shell。

## 4. packages 公共能力
- `ui`：统一公共组件库（shadcn/ui + Tailwind），禁止各 App 单独安装。
- `theme`：CSS Variables / Tailwind 配置 / 全局主题。
- `auth`：Token / 登录态 / 权限。
- `request`：统一 Axios 实例 + 请求/响应拦截 + 错误处理，所有接口走此模块。
- `utils`：纯工具函数（字符串/日期/数学/浏览器），不放业务。

## 5. 环境变量
公共 `.env` / `.env.development`，各 App 可覆盖；统一 `VITE_` 前缀。

## 6. 构建
每个 App 独立构建；packages 作为源码依赖参与构建、不单独部署；允许少量公共组件重复打包换取低耦合与独立部署。

## 7. AI 约束
严格按目录组织；shell 不写业务；公共能力优先入 packages；不重复创建公共组件/请求/认证/主题；新增业务平台作为新 `apps/*` 接入而非扩展 shell。
