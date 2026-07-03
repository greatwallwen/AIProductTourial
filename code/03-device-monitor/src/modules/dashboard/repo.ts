import type { Db } from '../../shared/db.ts';
import type { AlertView, HourlyPoint, MetricSummary, RawPoint } from './types.ts';

export function createDashboardRepo(db: Db) {
  return {
    queryRaw(deviceId: number, metric: string, from: string, to: string): RawPoint[] {
      return db
        .prepare(
          `SELECT ts, value FROM telemetry_raw
           WHERE device_id = ? AND metric = ? AND ts >= ? AND ts <= ?
           ORDER BY ts`
        )
        .all(deviceId, metric, from, to) as unknown as RawPoint[];
    },

    /** avg 不落库，查询时由 sum/cnt 得出 */
    queryHourly(deviceId: number, metric: string, fromHour: string, to: string): HourlyPoint[] {
      return db
        .prepare(
          `SELECT hour_ts AS hourTs, sum * 1.0 / cnt AS avg, min, max, cnt
           FROM telemetry_hourly
           WHERE device_id = ? AND metric = ? AND hour_ts >= ? AND hour_ts <= ?
           ORDER BY hour_ts`
        )
        .all(deviceId, metric, fromHour, to) as unknown as HourlyPoint[];
    },

    listAlerts(status?: string): AlertView[] {
      const where = status ? 'WHERE a.status = ?' : '';
      const params = status ? [status] : [];
      return db
        .prepare(
          `SELECT a.id, d.device_code AS deviceCode, d.name AS deviceName,
                  r.metric, r.op, r.threshold, r.level, r.title,
                  a.status, a.first_ts AS firstTs, a.last_ts AS lastTs, a.peak_value AS peakValue
           FROM alerts a
           JOIN alert_rules r ON r.id = a.rule_id
           JOIN devices d ON d.id = a.device_id
           ${where}
           ORDER BY a.id DESC`
        )
        .all(...params) as unknown as AlertView[];
    },

    /** 近 1 小时各指标聚合 + 最新读数（bare column 取 MAX(ts) 所在行的 value，SQLite 文档行为） */
    metricSummaries(deviceId: number, since: string): MetricSummary[] {
      const aggs = db
        .prepare(
          `SELECT metric, COUNT(*) AS cnt, AVG(value) AS avg, MIN(value) AS min, MAX(value) AS max
           FROM telemetry_raw
           WHERE device_id = ? AND ts >= ?
           GROUP BY metric ORDER BY metric`
        )
        .all(deviceId, since) as unknown as Array<Omit<MetricSummary, 'last' | 'lastTs'>>;
      // 每个 metric 的最新一条：用相关子查询取 MAX(ts) 那一行的 value，
      // 而非依赖 SQLite 的 bare-column 特例（GROUP BY 下取任意行），保证换 PG/标准 SQL 也成立。
      const lasts = db
        .prepare(
          `SELECT r.metric, r.value AS last, r.ts AS lastTs
           FROM telemetry_raw r
           WHERE r.device_id = ?
             AND r.ts = (SELECT MAX(r2.ts) FROM telemetry_raw r2
                         WHERE r2.device_id = r.device_id AND r2.metric = r.metric)`
        )
        .all(deviceId) as unknown as Array<{ metric: string; last: number; lastTs: string }>;
      const lastBy = new Map(lasts.map((l) => [l.metric, l]));
      return aggs.map((a) => {
        const l = lastBy.get(a.metric);
        return { ...a, last: l?.last ?? 0, lastTs: l?.lastTs ?? '' };
      });
    },
  };
}

export type DashboardRepo = ReturnType<typeof createDashboardRepo>;
