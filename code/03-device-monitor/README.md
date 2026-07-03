# 案例三示例工程：液压系统状态监测系统

《信息化产品系统架构设计实操教程》第 4 章配套工程。通用工程约定（目录范式、零构建运行、测试方案、scripts 含义）见[附录 C](../../docs/appendix/c-project-conventions.md)，本 README 只写本工程差异。

## 快速开始

```bash
npm ci
npm run db:reset   # 建库 + 种子数据（3 个试验台子系统、3 条告警规则、48 小时约 4000 点真实遥测）
npm run verify     # 类型检查 + 22 个测试 + 10 场景冒烟实录
npm start          # http://localhost:3003 ，内嵌看板在 / ，OpenAPI 文档在 /openapi.json
```

seed 完成即有 2 条 firing 告警（1 critical + 1 warning）——真实冷却器失效段落在最近约 10 小时，任何日期运行都真实命中。

## 本工程证明的架构决策（对应第 4 章 ADR）

| 决策 | 代码位置 | 作证的测试 |
|---|---|---|
| 写读分离的模块边界（未来的进程边界） | `modules/ingest`（只写）与 `modules/dashboard`（只读）互不 import，各自依赖 `registry` | `tests/architecture.test.ts` 规则 4 |
| 写入事务内增量维护聚合 | `ingest/repo.ts` 的 hourly UPSERT（avg 查询时 sum/cnt） | 同小时两批写入 cnt/sum/min/max 增量正确 |
| 幂等写入（重复上报是常态不是异常） | raw 表 `UNIQUE(device_id, metric, ts)` + INSERT OR IGNORE，以 `changes` 决定是否累计 | 重复 ts：raw 不增、hourly 不重复累计 |
| 有状态告警 + 数据库兜底防重 | `ingest/service.ts` 评估逻辑 + `ux_alerts_firing` 部分唯一索引 | 持续越限只更新不新增；绕过应用层直插被索引拒绝 |
| 查询自动选粒度 | `dashboard/service.ts`：跨度 > 6h 自动走小时聚合 | bucket 未指定时自动选粒度 |

## 模块结构

- `modules/registry`——设备档案（编码、型号、接入网关、位置）
- `modules/ingest`——遥测接入 + 告警评估（只写）：`POST /api/telemetry`、`POST /api/alerts/:id/ack`
- `modules/dashboard`——聚合查询 + 告警查询（只读）：`GET /api/devices/:code/metrics`、`/summary`、`GET /api/alerts`

告警状态机 3 态：`firing →(ack) acked`，值回落到阈值内时 `firing/acked → resolved`（终态）。同一规则同时至多一条未关闭告警，由部分唯一索引 `ux_alerts_firing` 在数据库层兜底。

`GET /` 返回内嵌 HTML 看板（单路由、零外部资源、原生 JS 每 5 秒轮询设备列表 + firing 告警 + 近 1 小时聚合）。

## 数据真实性声明

遥测为真实公开数据集：UCI 机器学习库第 447 号《液压系统状态监测》（ZeMA gGmbH / 萨尔大学采集，CC BY 4.0；引用 N. Helwig, E. Pignanelli, A. Schütze, IEEE I2MTC-2015）。对所选工作周期逐路取传感器均值，按数据集自带的真实故障标签（`profile.txt` 冷却器状态）以"健康 → 冷却器失效"顺序排列成退化时间线（详见 `dataset/MANIFEST.md`），数值未做修改。量纲直接沿用数据集（系统压力 bar、油温 ℃、泵振动 mm/s、冷却效率 %、冷却功率 kW、流量 l/min）；三个子系统资产编号（HYD-PMP-01 等）为演示标签。种子时间相对当前时刻生成，冷却器失效段落在最近约 10 小时。
