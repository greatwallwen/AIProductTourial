# 案例二示例工程：企业合同管理系统

《信息化产品系统架构设计实操教程》第 3 章配套工程。通用工程约定（目录范式、零构建运行、测试方案、scripts 含义）见[附录 C](../../docs/appendix/c-project-conventions.md)，本 README 只写本工程差异。

## 快速开始

```bash
npm ci
npm run db:reset   # 建库 + 种子数据（6 份覆盖 active/approving/派生 expired 的合同）
npm run verify     # 类型检查 + 28 个测试 + 8 场景冒烟实录
npm start          # http://localhost:3002 ，OpenAPI 文档在 /openapi.json
```

## 本工程证明的架构决策（对应第 3 章 ADR）

| 决策 | 代码位置 | 作证的测试 |
|---|---|---|
| ★仓储接口隔离：审批逻辑只依赖端口，零 SQL 可测 | `modules/approval/types.ts` 的 `ApprovalRepo` / `ContractGateway` 端口；`service.ts` 不 import sqlite | `tests/approval-chain.test.ts` 整个文件用内存 Fake，不碰 SQLite |
| 金额驱动审批链，提交时物化为任务 | `modules/approval/service.ts` 的 `CHAIN_LEVELS` 规则表 + `buildApprovalChain` 纯函数 | 2/3/4 步链、10万/100万阈值边界 |
| 顺序审批状态机：只有当前步可决策 | `approval/service.ts` 的 `decide`（`firstPending` 即"当前步"） | 越级决策 409、驳回后剩余 skipped、重提 round=2 |
| 零调度器到期提醒 / expired 派生不落库 | `contract/repo.ts` 的 `reminders` 一条 SQL；`contract/service.ts` 的 `toView` 派生 | 提醒精确命中不含过期与 approving 件、台账派生 expired |
| 金额以分存储，元字符串只在 API 边界 | `contract/service.ts` 的 `yuanToCents` / `centsToYuan`（全系统唯一换算位置，字符串整数运算不走浮点） | 起草后库内为 `amount_cents` 整数、接口精确回读元字符串 |
| 发号器与建单同事务 | `contract_seq` 表 UPSERT，在 `withTransaction` 内与 INSERT 同提交 | 并发起草 3 份编号连续不重号 |

## 模块结构

- `modules/contract`——起草、台账（含派生 expired）、到期提醒；合同状态机 `draft → approving → active/rejected（→ approving）`、`active → terminated` 归本模块所有
- `modules/approval`——审批链生成与顺序决策；**依赖 contract 的 service**，由组合根 `app.ts` 注入（跨模块只走 `index.ts`）

与案例一的关键差异：approval 的 service 不直接拿 `db`，工厂签名是 `createApprovalService({ repo, contracts, tx })`——三个都是接口/回调。SQLite 仓储实现（`createApprovalRepo`）与真事务只在 `app.ts` 连线，因此审批业务规则的全部测试可以在纯内存中运行。

审批链规则（提交时按金额物化到 `approval_tasks`）：

| 合同金额 | 审批链 |
|---|---|
| < 10 万元 | 法务（周敏）→ 部门负责人（王建国） |
| ≥ 10 万元 | + 分管副总（李雪梅） |
| ≥ 100 万元 | + 总经理（陈志远） |

## 数据真实性声明

企业名（如"杭州云栖鸿图网络科技有限公司"）、人名均为拟真但虚构；相对方注册地为 GB/T 2260 真实行政区划（`dataset/02-contract-ledger/regions.json` 校验，见 `dataset/MANIFEST.md`），印花税按《印花税法》真实法定税率计算示例；合同金额为演示值。种子数据走 service 层真实流程（起草→提交→按序审批）生成，业务日期相对当前时刻偏移，`created_at`/`decided_at` 事后用 SQL 回拨——保证到期提醒演示（`GET /api/contracts/reminders?days=30`）任何日期运行都恰好命中 2 件，且台账里始终有一件"库内 active、派生 expired"的过期合同。
