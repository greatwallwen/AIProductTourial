# 案例一示例工程：政务事项申报审批系统

《信息化产品系统架构设计实操教程》第 2 章配套工程。通用工程约定（目录范式、零构建运行、测试方案、scripts 含义）见[附录 C](../../docs/appendix/c-project-conventions.md)，本 README 只写本工程差异。

## 快速开始

```bash
npm ci
npm run db:reset   # 建库 + 种子数据（5 个真实行政审批事项、6 份覆盖各状态的申报单）
npm run verify     # 类型检查 + 17 个测试 + 8 场景冒烟实录
npm start          # http://localhost:3001 ，OpenAPI 文档在 /openapi.json
```

## 本工程证明的架构决策（对应第 2 章 ADR）

| 决策 | 代码位置 | 作证的测试 |
|---|---|---|
| 状态机是一等公民数据结构（ADR-003） | `src/modules/application/service.ts` 的 `TRANSITIONS` 迁移表 | 非法迁移 409 带 `allowedActions`、终态封闭 |
| 模块边界与组合根注入（ADR-001） | `src/app.ts` 装配 `catalog → application` | `tests/architecture.test.ts` 三条规则 |
| 配置驱动的业务规则（ADR-002 思想） | 材料清单/承诺时限存于 `catalog_items`，校验数据驱动 | 缺材料 400 并列出缺项 |
| 审计留痕只增不改 | `approval_logs` 仅 INSERT | 全流程 5 条留痕 |

## 模块结构

- `modules/catalog`——事项目录（事项、材料清单、法定/承诺时限）
- `modules/application`——申报与审批（状态机、发号、超期查询）

状态机 8 态：`submitted → accepted ⇄ supplementing / accepted → in_review → approved → concluded`，含 `not_accepted`、`denied` 两个否定终态，与第 2 章状态机图逐字一致。

## 数据真实性声明

事项名称（如"食品经营许可证新办"）为真实存在的行政审批事项（公开目录信息）；受理区划取自 GB/T 2260 真实行政区划（`dataset/01-gov-approval/divisions.json`，见 `dataset/MANIFEST.md`），实施机关按真实区划名限定（如徐汇区市场监督管理局），申报编号前缀 310104 为徐汇区真实区划码；承诺时限为演示值；企业名、人名为虚构；证件号存脱敏格式。种子时间相对当前时刻生成，超期预警演示（`GET /api/applications?overdue=true`）任何日期运行都会真实命中一件。
