# 附录 C：示例工程共用约定

本书四个示例工程（`code/01-gov-approval` ~ `code/04-saas-ticket`）遵循完全一致的工程约定。约定只在本附录说明一次，各工程 README 仅写"本工程差异"。

**四个工程是四个完全独立的 npm 包，互不引用。** 共 300 行左右的基础设施代码（`shared/db.ts`、`shared/errors.ts`、`tests/architecture.test.ts`）在四个工程中各有一份拷贝——这是有意的决策：抽公共包的代价（workspace 机制、四工程被迫同步升级、破坏"单目录即全貌"）大于四份拷贝的维护成本。**复制约定，而不是复制抽象**（Occam）。一致性由目录范式与 scripts 命名完全一致来维持。

## C.1 运行环境与零构建

- 要求 Node.js ≥ 24（实测环境 v24.16.0）。利用 Node 原生 TypeScript 类型剥离（`process.features.typescript === "strip"`），**不存在构建步骤**：`node src/server.ts` 直接运行 .ts 文件，`tsc --noEmit` 仅做类型检查。
- 类型剥离的语法约束（tsconfig 用 `erasableSyntaxOnly` 拦截）：相对导入必须带 `.ts` 后缀；不可用 `enum` / `namespace` / 构造函数参数属性。状态集合一律用 `as const` 对象 + 联合类型表达——这恰好也是状态机代码的更佳写法（值可枚举、可遍历、可打印）。
- `node:sqlite`（类 `DatabaseSync`）作为数据库：Node 24 中无需任何 flag，稳定性为 Release Candidate 级（Stability 1.2，见 Node 官方文档 nodejs.org/docs/latest-v24.x/api/sqlite.html）。教程数据量下同步 API 的事件循环阻塞无感，此权衡在各案例正文中已声明。

## C.2 依赖面（四工程完全一致）

| 类型 | 包 | 说明 |
|---|---|---|
| dependencies | `fastify` | 日志(pino)、请求校验(Ajv/JSON Schema)、序列化、注入测试(light-my-request)全部内置 |
| dependencies | `@fastify/swagger` | 从路由 JSON Schema 自动生成 OpenAPI 文档（`GET /openapi.json`），"契约即代码"的真实产物 |
| devDependencies | `typescript`、`@types/node` | 仅类型检查 |

**明确不引入**（各案例 ADR 与正文引用此清单）：`better-sqlite3`（原生编译是环境不可控风险，且 `node:sqlite` 已够用）、`zod`（Fastify 内置 Ajv 校验 JSON Schema，双写 schema 与 TS 类型在每工程 5~8 个 body 类型的规模下，重复成本低于引依赖的抽象成本）、`fastify-plugin`（跨模块依赖由组合根显式注入，不走 decorator）、`vitest / tsx / ts-node / nodemon / supertest`（均被 Node 内置能力替代）。

`package-lock.json` 必须提交，保证教程可复现。实测版本：fastify 5.9.x。

## C.3 目录范式（目录即架构）

```
0X-xxx/
├── package.json / package-lock.json / tsconfig.json / README.md
├── data/                    # 运行时 SQLite 文件（gitignore）
├── scripts/smoke.ts         # 冒烟：起真实服务→按剧本打请求→打印实录
├── src/
│   ├── server.ts            # 唯一入口：buildApp() + listen，10 行以内
│   ├── app.ts               # ★组合根：openDb → 构造各模块 service → 注册路由
│   ├── config.ts            # 端口、db 路径（读 env 带默认值）
│   ├── shared/
│   │   ├── db.ts            # node:sqlite 封装：openDb / withTransaction
│   │   └── errors.ts        # AppError(code, statusCode) + 全局 errorHandler
│   ├── db/
│   │   ├── migrate.ts       # 按文件名序执行 migrations/*.sql，记录 schema_migrations
│   │   ├── migrations/001_init.sql
│   │   └── seed.ts          # 种子数据（时间字段一律相对 Date.now() 偏移）
│   └── modules/<domain>/    # 每个业务模块一个目录，边界即目录
│       ├── index.ts         # ★模块唯一公共出口
│       ├── routes.ts        # HTTP 层：schema 校验 + 调 service，不写业务
│       ├── service.ts       # 业务逻辑/状态机；不 import fastify，不写 SQL
│       ├── repo.ts          # 只有 SQL；不含业务判断
│       └── types.ts         # 领域类型
└── tests/
    ├── architecture.test.ts # ★架构守护测试（见 C.5）
    └── <domain>.test.ts     # 业务测试：app.inject + ':memory:' 数据库
```

三条硬约定（模块化单体的落地形式）：

1. **依赖方向单向**：`routes → service → repo → shared/db`，反向 import 违规；
2. **跨模块只走 `index.ts`**：模块 B 需要模块 A 的能力时，由 `app.ts`（组合根）创建 A 的 service 并作为构造参数注入 B。`app.ts` 因此成为全系统依赖图的唯一可视位置；
3. **service / repo 禁止 import fastify**：领域层对 HTTP 无感知。

模块工厂签名范式：

```ts
// modules/<domain>/index.ts
export function createXxxService(deps: { db: Db; other?: OtherService }): XxxService;
export function xxxRoutes(service: XxxService): FastifyPluginAsync;
```

## C.4 npm scripts（四工程完全一致）

```jsonc
{
  "start":      "node src/server.ts",
  "dev":        "node --watch src/server.ts",
  "db:migrate": "node src/db/migrate.ts",
  "db:seed":    "node src/db/seed.ts",
  "db:reset":   "node src/db/migrate.ts --fresh && node src/db/seed.ts",
  "test":       "node --test \"tests/**/*.test.ts\"",
  "typecheck":  "tsc --noEmit",
  "smoke":      "node scripts/smoke.ts",
  "verify":     "npm run typecheck && npm test && npm run smoke"
}
```

`npm run verify` 全绿 = 该工程"真实可运行"的证明。根目录 `scripts/verify-all.sh` 对四工程依次执行 `npm ci && npm run verify`。

## C.5 架构守护测试

每工程 `tests/architecture.test.ts` 用 `fs` 遍历 `src/` + 正则解析 import 语句，断言 C.3 的三条硬约定。工程三、四各追加第 4 条：工程三禁止 ingest 与 dashboard 互相 import（写读两进程的边界预留）；工程四扫描**全部 `modules/**/repo.ts`**，对每条 SQL 计数——作用域表（tickets/ticket_events/users/ticket_seq，`tenants` 注册表根按设计豁免）的每一处 `FROM/JOIN/UPDATE` 引用都必须配一个独立的 `tenant_id = ?` 谓词，`INSERT` 因由列携带 tenant_id 而豁免。计数法（谓词数 ≥ 引用数）比"整串包含 `tenant_id = ?`"强：子查询里放一个谓词、外层裸查的绕过写法会被判违规，测试里有一条"自证"用例专门喂这种绕过样本验证扫描器不失灵。三条规则各带"扫描文件/语句数下限"断言，防止 glob 匹配为空时测试空过。**架构决策若不能被机器守护，就只是墙上的海报**——这份不到 130 行的测试是本书这一主张的直接实证。

## C.6 测试与种子数据

- 测试运行器 `node --test`；HTTP 测试用 fastify 自带 `app.inject()`（不占端口）；每个测试文件用 `buildApp({ dbPath: ':memory:' })` 独立建库 → migrate → 按需 seed，天然隔离。
- **种子时间铁律**：所有时间字段相对 `Date.now()` 偏移生成（如"到期日 = now + 12 天"），绝不写死绝对日期——保证"到期提醒 / 超期预警 / 告警"类演示在任何日期运行都真实命中。
- 种子数据拟真但虚构：行政审批事项名称使用真实存在的公开事项（公开目录信息），企业名 / 人名 / 证件号为虚构或脱敏格式，各工程 README 均有声明。

## C.7 端口分配

| 工程 | 端口 |
|---|---|
| 01-gov-approval | 3001 |
| 02-contract-ledger | 3002 |
| 03-device-monitor | 3003 |
| 04-saas-ticket | 3004 |

冒烟脚本的端口可用 `SMOKE_PORT` 环境变量覆盖（端口占用时改它即可），子进程与断言取同一值。

## C.8 接口契约约定（四工程一致，各案例只引用不重述）

第 1 章第⑥步要求接口有全局约定。四个工程共用下面这套约定，案例章节遇到具体接口时直接引用本节，不再各讲一遍。

**错误信封**。所有错误响应统一形状，由 `shared/errors.ts` 的 `AppError` 与 `app.ts` 的全局 `setErrorHandler` 保证：

```json
{ "error": { "code": "MACHINE_CODE", "message": "给人读的中文", "details": { } } }
```

`code` 是稳定的机器可判别字符串（前端据此分支，不解析 `message`）；`message` 面向人、可改；`details` 可选，携带结构化上下文（如缺失的材料清单、允许的动作）。请求体校验失败由 Fastify 内置 Ajv 拦截，归一化为 `code: "VALIDATION_FAILED"`。

**状态机接口回带可用动作**。流转类接口（`POST …/actions`、`…/transition`、`…/decision`）在非法迁移时返回 409，`details` 带 `currentStatus` 与 `allowedActions`——前端的按钮可用性、错误提示、测试断言三者读同一份数据，无需各自硬编码状态规则。

**幂等**。创建类接口以业务唯一键去重：申报编号、合同编号、工单编号均为 `UNIQUE`，发号在建单同一事务内完成；遥测写入以 `(device_id, metric, ts)` 唯一键 `INSERT OR IGNORE`，重复上报不重复入库、不重复累计聚合（见第 4 章）。

**不泄露存在性**。跨租户、越权访问返回 **404 而非 403**——403 等于承认"资源存在但你无权"，本身是一次信息泄露（见第 5 章）。同理，数据范围外的列表查询返回空集而非报错（见第 3 章）。

**分页与筛选**。列表接口用查询参数筛选（`?status=&overdue=`、`?priority=`），当前数据量级下不做游标分页；何时引入分页登记在各案例的演进触发表。

**契约即代码**。以上约定不靠文档维持一致，靠代码：路由的 JSON Schema 同时做入参校验与文档生成（`@fastify/swagger`），`GET /openapi.json` 的输出即当前真实契约。
