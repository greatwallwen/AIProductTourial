# 案例四示例工程：SaaS 多租户工单系统

《信息化产品系统架构设计实操教程》第 5 章配套工程。通用工程约定（目录范式、零构建运行、测试方案、scripts 含义）见[附录 C](../../docs/appendix/c-project-conventions.md)，本 README 只写本工程差异。

## 快速开始

```bash
npm ci
npm run db:reset   # 建库 + 种子数据（3 个真实仓库租户、48 张真实 GitHub issue 工单）
npm run verify     # 类型检查 + 18 个测试 + 9 场景冒烟实录
npm start          # http://localhost:3004 ，OpenAPI 文档在 /openapi.json
```

工单接口全部需要 `X-API-Key` 请求头（`POST /api/tenants/register` 除外）：

```bash
curl -s "http://localhost:3004/api/tickets" -H "X-API-Key: wd_mingrui_2f5015854250a00e7688d770"
```

## 本工程的招牌：租户隔离双保险

单库多租户下，「别的租户的数据绝不可见」不能只靠一处代码的自觉，本工程用两道互相独立的防线表达它：

1. **鉴权子作用域（边界防线）**：工单路由整体注册在挂了 `onRequest` 鉴权钩子的 fastify 子作用域内（`src/app.ts`），安全边界由 encapsulation 表达——域内任何路由都不可能绕过 `X-API-Key`，新增路由自动被覆盖；
2. **repo 层强制隔离（数据防线）**：`modules/**/repo.ts` 中查询作用域表（tickets/ticket_events/users/ticket_seq）的函数，第一个参数必须是 `tenantId`，SELECT/UPDATE 一律 `WHERE tenant_id = ?`。即使某个 service 写错了，SQL 也查不到他租户的行。

两道防线各自失效时另一道仍然成立；第二道还被架构守护测试的规则 4（扫描全部 repo 源码、按"谓词数 ≥ 作用域表引用数"计数，并有自证用例验证扫描器能抓子查询绕过）机器化看守。跨租户访问一律返回 **404 而非 403**——403 等于承认「资源存在但你无权」，本身就是一次信息泄露。

## 本工程证明的架构决策（对应第 5 章 ADR）

| 决策 | 代码位置 | 作证的测试 |
|---|---|---|
| 隔离保险一：鉴权子作用域 | `src/app.ts` 鉴权域 + `modules/tenant/auth.ts` | 无 Key/错 Key 401 |
| 隔离保险二：repo 强制 `tenant_id = ?` | `modules/ticket/repo.ts` 全部 SQL | A 的 Key 查 B 的工单 404、列表绝不含他租户、架构守护规则 4 |
| API Key 只存 sha256 哈希 | `modules/tenant/service.ts` | 注册返回明文 Key 且库中只有哈希 |
| 租户开通是单事务（租户+admin+发号器） | `modules/tenant/service.ts` 的 `register` | 注册后立即建单即得 `-0001` |
| 每租户独立发号 `{TENANT_CODE}-0001` | `ticket_seq` 表 + `repo.nextTicketNo` | 两租户编号互不干扰 |
| 状态机是一等公民数据结构 | `modules/ticket/service.ts` 的 `TRANSITIONS` 迁移表 | 非法迁移 409 带 `allowedActions` |
| 事件流只增不改 | `ticket_events` 仅 INSERT | 事件流完整（created + 每次流转） |

状态机 4 态：`open ─start→ in_progress ─resolve→ resolved ─close→ closed`，外加回路 `resolved ─reopen→ in_progress`，与第 5 章状态机图逐字一致。

## 模块结构

- `modules/tenant`——租户注册开通（单事务）与 API Key 鉴权（哈希查表 + onRequest 钩子）
- `modules/ticket`——工单建单/列表/详情/状态机流转，repo 层强制租户隔离

两模块零相互 import：ticket 只依赖鉴权钩子写入 request 的 `{tenantId, tenantCode}`（结构化类型对接），连线只发生在组合根 `src/app.ts`。

## 种子租户与开发用 API Key

种子 Key 的随机部分取 `sha256(tenantCode + 'seed-salt')` 前 24 hex——固定可复现，每次 `db:reset` 后不变，故可直接写在这里。**开发种子专用**，生产注册永远走 `node:crypto` 随机。

| 租户码 | 企业（仓库所属公司） | 套餐 | 开发种子专用 API Key |
|---|---|---|---|
| SUPABASE | Supabase Inc.（`supabase/supabase`） | pro | `wd_supabase_b6d586079c13fa6651fc18a4` |
| PRISMA | Prisma Data, Inc.（`prisma/prisma`） | pro | `wd_prisma_c759423f7b16237cf2070804` |
| VERCEL | Vercel Inc.（`vercel/next.js`） | standard | `wd_vercel_c48554183a5e6d2345f29454` |

## 数据真实性声明

工单为真实数据：每个租户对应一个公开 GitHub 仓库，工单取自该仓库的真实 issue（`title`/`state`/`labels`/`created_at`/`closed_at` 均为原始值，见 `dataset/MANIFEST.md`）。租户企业名为仓库所属公司；套餐、管理员账号、API Key 为应用内部演示配置（合成）；邮箱一律使用保留域 `example.com`。issue 的真实创建时刻整体回拨到相对当前的时间轴（已关闭工单的事件铺在真实的创建→关闭区间内），任何日期运行 `db:reset` 都得到真实的 SLA 时间线。
