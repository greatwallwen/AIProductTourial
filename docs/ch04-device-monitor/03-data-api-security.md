# 4.3 数据管道：从传感器到看板的一条河

> 流程进度：①②③ ▸ ④⑤ ▸ **⑥⑦** ▸ ⑧

## 招牌视图：带速率标注的数据流管道

![遥测数据流管道（动画：数据点沿管道流动）](images/03-data-pipeline.svg)

这张图是本案例的"一图版"：设备（Modbus 多路传感）→ 网关归一（S7-1200，本地缓存）→ MQTT QoS 1（约 400 点/秒）→ ingest（幂等写入 + 增量聚合 + 告警匹配，同一事务）→ TimescaleDB（raw 30 天 / 聚合 3 年）← api（自动选粒度查询、SSE）← 看板。每一段都标注了协议与速率：架构图上没有数字，就还不算做完第③步。

## 遥测数据模型：窄表 + 分层老化

![遥测数据模型：窄表、分区与三级聚合](images/04-telemetry-model.svg)

窄表（`device_id, metric, ts, value` 一行一点）而非宽表（一行一设备多列）：设备型号不同、指标集不同，宽表会长出几十个大多为 NULL 的列；窄表以 `(device_id, metric, ts)` 复合唯一索引同时服务幂等与序列查询。

生产设计的 TimescaleDB 三件套（真实 SQL）：

```sql
-- hypertable：按天自动分块
SELECT create_hypertable('telemetry_raw', 'ts', chunk_time_interval => INTERVAL '1 day');

-- 连续聚合：小时粒度物化视图（1min/1d 同理）
CREATE MATERIALIZED VIEW telemetry_hourly WITH (timescaledb.continuous) AS
SELECT device_id, metric, time_bucket('1 hour', ts) AS bucket,
       count(*) AS cnt, avg(value) AS avg, min(value) AS min, max(value) AS max
FROM telemetry_raw GROUP BY device_id, metric, bucket;

-- 保留策略：原始数据 30 天自动老化（Q-04 的磁盘上界）
SELECT add_retention_policy('telemetry_raw', INTERVAL '30 days');
```

示例工程在 SQLite 上实现了同构语义：raw 表加 hourly 聚合表，写入事务内增量 UPSERT（`cnt=cnt+新增, sum=sum+…, min/max 取劣`），avg 由查询时 `sum/cnt` 计算。冒烟实录展示幂等语义，同一批数据发两遍：

```bash
$ curl -s -X POST "http://localhost:3993/api/telemetry" \
    -H 'Content-Type: application/json' \
    -d '[{"deviceCode":"HYD-PMP-01","metric":"pump_vibration","ts":"2026-07-03T06:52:59.357Z","value":0.61},{"deviceCode":"HYD-PMP-01","metric":"pump_vibration","ts":"2026-07-03T06:53:59.357Z","value":0.63}]'
# 第一遍：HTTP 201
{ "received": 2, "inserted": 2, "duplicates": 0, "alertsFired": [], "alertsResolved": [] }
# 同一批第二遍：HTTP 201
{ "received": 2, "inserted": 0, "duplicates": 2, "alertsFired": [], "alertsResolved": [] }
```

重复不报错、不重复入库、不重复累计聚合（以 INSERT 的 changes 判定是否累计），这是 QoS 1"至少一次"语义的平台侧另一半，有专门测试作证。

## 断网续传的完整闭环

![断网续传时序图](images/06-offline-replay-seq.svg)

网关本地缓存（断网期间落盘）→ 恢复后按序补传（MQTT QoS 1 重发）→ 平台幂等去重（上面的实录）。三个环节各自独立成立，合起来兑现 Q-05："断网 2 小时，库中无缺口、无重复"。

## 有状态告警：不是"发通知"，是一台状态机

![告警状态机](images/05-alert-state-machine.svg)

告警的生命周期：`firing`（首次越限）→ `acked`（值班确认）→ `resolved`（值回落自动恢复）。两个容易做错的语义都有真实实录：

**持续越限不轰炸。** HYD-CLR-01 的冷却效率在种子数据里持续低于阈值约 10 小时（120 个周期），告警列表里只有一条 critical，`first_ts` 到 `last_ts` 拉开约 10 小时、`peak_value` 记录最劣值 19.4%：

```json
{
  "id": 2, "deviceCode": "HYD-CLR-01", "metric": "cooling_efficiency",
  "op": "<", "threshold": 30, "level": "critical", "title": "冷却效率骤降（冷却器接近失效）",
  "status": "firing",
  "firstTs": "2026-07-02T20:59:28.434Z", "lastTs": "2026-07-03T06:54:28.434Z",
  "peakValue": 19.4
}
```

去重的最后防线不在应用层：部分唯一索引 `UNIQUE(rule_id) WHERE status IN ('firing','acked')` 让数据库直接拒绝第二条活动告警（测试中绕过应用层直插被拒）。这是第 1 章"架构决策要可被机器守护"的数据库版。

**回落自动恢复。** 上报一个阈值内的值，响应体的 `alertsResolved` 即时携带恢复事件（冒烟场景 7），值班无需手工关闭。

## 查询：自动选粒度

`GET /api/devices/:code/metrics?metric=oil_temperature&from=&to=` 按窗口跨度自动路由：≤ 6 小时走 raw（细节），更长走 hourly（趋势），调用方无需理解存储分层（Q-03）。显式 `bucket=raw|hour` 可覆盖。冷却效率、油温这些指标的量纲与判读（%、°C，以及"冷却器接近失效"的语义）由规则表的 title 携带进告警文案：领域知识进数据，不进代码。
