import type { Db } from '../../shared/db.ts';
import type { AlertRule, AlertStatus } from './types.ts';

interface RuleRow {
  id: number;
  device_id: number;
  metric: string;
  op: string;
  threshold: number;
  level: string;
  title: string;
}

interface AlertRow {
  id: number;
  rule_id: number;
  device_id: number;
  status: string;
  first_ts: string;
  last_ts: string;
  peak_value: number;
}

export function createIngestRepo(db: Db) {
  return {
    /**
     * 幂等写入：命中 (device_id, metric, ts) 唯一索引时 OR IGNORE 静默跳过。
     * 返回实际插入行数（0 或 1）——调用方以此决定是否累计 hourly 与评估告警。
     */
    insertRaw(deviceId: number, metric: string, ts: string, value: number): number {
      const r = db
        .prepare('INSERT OR IGNORE INTO telemetry_raw (device_id, metric, ts, value) VALUES (?, ?, ?, ?)')
        .run(deviceId, metric, ts, value);
      return Number(r.changes);
    },

    /** 小时聚合增量维护：同事务内 UPSERT，avg 留到查询时 sum/cnt */
    upsertHourly(deviceId: number, metric: string, hourTs: string, value: number): void {
      db.prepare(
        `INSERT INTO telemetry_hourly (device_id, metric, hour_ts, cnt, sum, min, max)
         VALUES (?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT(device_id, metric, hour_ts) DO UPDATE SET
           cnt = cnt + excluded.cnt,
           sum = sum + excluded.sum,
           min = MIN(min, excluded.min),
           max = MAX(max, excluded.max)`
      ).run(deviceId, metric, hourTs, value, value, value);
    },

    listRules(deviceId: number, metric: string): AlertRule[] {
      const rows = db
        .prepare('SELECT * FROM alert_rules WHERE device_id = ? AND metric = ? ORDER BY id')
        .all(deviceId, metric) as unknown as RuleRow[];
      return rows.map((r) => ({
        id: r.id,
        deviceId: r.device_id,
        metric: r.metric,
        op: r.op as AlertRule['op'],
        threshold: r.threshold,
        level: r.level as AlertRule['level'],
        title: r.title,
      }));
    },

    /** 该规则当前未关闭（firing/acked）的告警；部分唯一索引保证至多一条 */
    getOpenAlert(ruleId: number): AlertRow | undefined {
      return db
        .prepare("SELECT * FROM alerts WHERE rule_id = ? AND status IN ('firing', 'acked')")
        .get(ruleId) as unknown as AlertRow | undefined;
    },

    getAlertById(id: number): AlertRow | undefined {
      return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as unknown as AlertRow | undefined;
    },

    insertAlert(input: { ruleId: number; deviceId: number; ts: string; value: number }): number {
      const r = db
        .prepare(
          `INSERT INTO alerts (rule_id, device_id, status, first_ts, last_ts, peak_value)
           VALUES (?, ?, 'firing', ?, ?, ?)`
        )
        .run(input.ruleId, input.deviceId, input.ts, input.ts, input.value);
      return Number(r.lastInsertRowid);
    },

    /** 持续越限：只推进 last_ts 与 peak_value，不新增行 */
    touchAlert(id: number, lastTs: string, peakValue: number): void {
      db.prepare('UPDATE alerts SET last_ts = ?, peak_value = ? WHERE id = ?').run(lastTs, peakValue, id);
    },

    setStatus(id: number, status: AlertStatus, lastTs?: string): void {
      db.prepare('UPDATE alerts SET status = ?, last_ts = COALESCE(?, last_ts) WHERE id = ?').run(
        status,
        lastTs ?? null,
        id
      );
    },
  };
}

export type IngestRepo = ReturnType<typeof createIngestRepo>;
