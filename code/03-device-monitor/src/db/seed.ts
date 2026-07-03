import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../shared/db.ts';
import { config } from '../config.ts';
import { runMigrations } from './migrate.ts';
import { createRegistryService } from '../modules/registry/index.ts';
import { createIngestService } from '../modules/ingest/index.ts';
import type { TelemetryPoint } from '../modules/ingest/index.ts';

/**
 * 种子数据。
 * 监测对象：ZeMA / 萨尔大学液压状态监测试验台的三个子系统（主泵机组 / 冷却过滤回路 / 主工作回路）。
 * 遥测为该试验台真实传感器读数，取自 UCI-447 数据集（CC BY 4.0），逐周期取均值后按"健康→冷却器失效"
 * 退化顺序排列（详见 dataset/MANIFEST.md），数值未做修改。设备资产编号为演示标签。
 * 铁律：时间字段一律相对 Date.now() 偏移——真实退化段落在最近 10 小时，seed 完成即有 firing 告警。
 */
const DATASET = join(import.meta.dirname, '..', '..', '..', '..', 'dataset', '03-device-monitor', 'hydraulic-window.csv');

const db = openDb(config.dbPath);
runMigrations(db);

const now = Date.now();
const DAY = 86_400_000;
const STEP = 5 * 60_000; // 5 分钟间隔（每个真实周期占一个采样点）
const GATEWAY = 'ZeMA 多速率采集台架 (1/10/100 Hz)';

// ---------- 设备档案（试验台子系统）----------
const insertDevice = db.prepare(
  `INSERT INTO devices (device_code, name, model, vendor, gateway, location, installed_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const DEVICES: Array<[string, string, string, string, string, number]> = [
  // [编码, 名称, 型号/子系统, 厂商, 位置, 投运于 N 天前]
  ['HYD-PMP-01', '主泵机组', '轴向柱塞泵主回路', 'ZeMA 液压试验台', '一号试验台', 900],
  ['HYD-CLR-01', '冷却过滤回路', '板式换热器 + 滤芯', 'ZeMA 液压试验台', '一号试验台', 900],
  ['HYD-FLW-01', '主工作回路', '换向阀 + 节流负载', 'ZeMA 液压试验台', '一号试验台', 900],
];
for (const [code, name, model, vendor, location, daysAgo] of DEVICES) {
  insertDevice.run(code, name, model, vendor, GATEWAY, location, new Date(now - daysAgo * DAY).toISOString().slice(0, 10));
}

// ---------- 告警规则 ----------
const insertRule = db.prepare(
  `INSERT INTO alert_rules (device_id, metric, op, threshold, level, title)
   SELECT id, ?, ?, ?, ?, ? FROM devices WHERE device_code = ?`
);
const RULES: Array<[string, string, '>' | '<', number, 'warning' | 'critical', string]> = [
  // [设备, 指标, op, 阈值, 级别, 标题]。冷却器退化 → 冷却效率骤降 + 油温升高，两条告警由真实故障段触发。
  ['HYD-CLR-01', 'cooling_efficiency', '<', 30, 'critical', '冷却效率骤降（冷却器接近失效）'],
  ['HYD-CLR-01', 'oil_temperature', '>', 49, 'warning', '液压油温异常升高'],
  // 主回路压力上限：种子数据（约 108 bar）不触发，留给冒烟脚本现场制造一次越限
  ['HYD-PMP-01', 'system_pressure', '>', 130, 'warning', '主回路压力过高'],
];
for (const [code, metric, op, threshold, level, title] of RULES) {
  insertRule.run(metric, op, threshold, level, title, code);
}

// ---------- 遥测：读取真实液压试验台数据窗口 ----------
// CSV 列 → (设备, 指标)。同一物理量直接映射，量纲不变。
const CHANNELS: Array<{ col: string; deviceCode: string; metric: string }> = [
  { col: 'PS2_bar', deviceCode: 'HYD-PMP-01', metric: 'system_pressure' },
  { col: 'VS1_mms', deviceCode: 'HYD-PMP-01', metric: 'pump_vibration' },
  { col: 'TS1_C', deviceCode: 'HYD-CLR-01', metric: 'oil_temperature' },
  { col: 'TS3_C', deviceCode: 'HYD-CLR-01', metric: 'cooler_outlet_temp' },
  { col: 'CE_pct', deviceCode: 'HYD-CLR-01', metric: 'cooling_efficiency' },
  { col: 'CP_kW', deviceCode: 'HYD-CLR-01', metric: 'cooling_power' },
  { col: 'FS1_lmin', deviceCode: 'HYD-FLW-01', metric: 'volume_flow' },
];

const lines = readFileSync(DATASET, 'utf8').trim().split('\n');
const header = lines[0]!.split(',');
const idx = (name: string) => header.indexOf(name);
const rows = lines.slice(1).map((l) => l.split(','));
const N = rows.length;
// 第 i 行 → 时间戳：最后一行对齐 now，向前每行退 5 分钟（真实退化段因此落在最近 10 小时）
const tsAt = (i: number) => new Date(now - (N - 1 - i) * STEP).toISOString();

const registry = createRegistryService({ db });
const ingest = createIngestService({ db, registry });

let totalInserted = 0;
for (const ch of CHANNELS) {
  const col = idx(ch.col);
  const points: TelemetryPoint[] = rows.map((r, i) => ({
    deviceCode: ch.deviceCode,
    metric: ch.metric,
    ts: tsAt(i),
    value: Number(r[col]),
  }));
  const res = ingest.ingestBatch(points);
  totalInserted += res.inserted;
  console.log(`已载入序列 ${ch.deviceCode}/${ch.metric}：${res.inserted} 点`);
}

const hourlyCount = (db.prepare('SELECT COUNT(*) AS n FROM telemetry_hourly').get() as { n: number }).n;
console.log(`遥测共 ${totalInserted} 行（raw），小时聚合 ${hourlyCount} 桶`);

const alerts = db
  .prepare(
    `SELECT a.status, r.level, r.title, d.device_code AS code, a.peak_value AS peak
     FROM alerts a JOIN alert_rules r ON r.id = a.rule_id JOIN devices d ON d.id = a.device_id
     ORDER BY a.id`
  )
  .all() as Array<{ status: string; level: string; title: string; code: string; peak: number }>;
console.log(
  `告警摘要：${alerts.length} 条 —— ` +
    alerts.map((a) => `[${a.level}/${a.status}] ${a.code} ${a.title}（峰值 ${a.peak}）`).join('；')
);
db.close();
