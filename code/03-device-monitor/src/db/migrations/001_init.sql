-- 案例三：工厂设备监控系统 初始结构
-- 告警状态值与 src/modules/ingest/types.ts 逐字一致

CREATE TABLE devices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_code  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  model        TEXT NOT NULL,           -- 真实存在的设备型号（厂商公开资料）
  vendor       TEXT NOT NULL,
  gateway      TEXT NOT NULL,           -- 接入网关（PLC 型号）
  location     TEXT NOT NULL,
  installed_at TEXT NOT NULL
);

-- 原始遥测：只增不改。唯一索引同时承担两个职责——
-- 幂等写入（INSERT OR IGNORE 命中即跳过）+ 序列查询加速（device_id, metric, ts 前缀匹配）
CREATE TABLE telemetry_raw (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  metric    TEXT NOT NULL,
  ts        TEXT NOT NULL,              -- ISO 8601 文本（UTC，可按字典序比较）
  value     REAL NOT NULL
);
CREATE UNIQUE INDEX ux_raw_series ON telemetry_raw(device_id, metric, ts);

-- 小时级聚合：写入事务内增量 UPSERT 维护，avg 由查询时 sum/cnt 得出
CREATE TABLE telemetry_hourly (
  device_id INTEGER NOT NULL REFERENCES devices(id),
  metric    TEXT NOT NULL,
  hour_ts   TEXT NOT NULL,              -- ts 截断到整点（ISO 8601）
  cnt       INTEGER NOT NULL,
  sum       REAL NOT NULL,
  min       REAL NOT NULL,
  max       REAL NOT NULL,
  PRIMARY KEY (device_id, metric, hour_ts)
);

CREATE TABLE alert_rules (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  metric    TEXT NOT NULL,
  op        TEXT NOT NULL CHECK (op IN ('>', '<')),
  threshold REAL NOT NULL,
  level     TEXT NOT NULL CHECK (level IN ('warning', 'critical')),
  title     TEXT NOT NULL
);
CREATE INDEX idx_rules_series ON alert_rules(device_id, metric);

CREATE TABLE alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id    INTEGER NOT NULL REFERENCES alert_rules(id),
  device_id  INTEGER NOT NULL REFERENCES devices(id),
  status     TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'acked', 'resolved')),
  first_ts   TEXT NOT NULL,
  last_ts    TEXT NOT NULL,
  peak_value REAL NOT NULL
);
-- 部分唯一索引兜底：同一规则同时至多一条未关闭（firing/acked）告警，
-- 即使应用层评估逻辑有 bug，数据库也拒绝重复告警
CREATE UNIQUE INDEX ux_alerts_firing ON alerts(rule_id) WHERE status IN ('firing', 'acked');
CREATE INDEX idx_alerts_status ON alerts(status);
