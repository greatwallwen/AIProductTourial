import type { Db } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import type { RegistryService } from '../registry/index.ts';
import { createDashboardRepo } from './repo.ts';
import type { AlertStatus, Bucket, MetricsQuery } from './types.ts';

/** 超过该跨度未显式指定 bucket 时自动切到小时聚合 */
const AUTO_HOUR_THRESHOLD_MS = 6 * 3600_000;

/** ts 截断到整点。与 ingest 的同名函数有意各自实现：两模块互不依赖（写读分离）。 */
function hourFloor(ts: string): string {
  const d = new Date(ts);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function parseIso(name: string, value: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new AppError('INVALID_RANGE', 400, `无法解析的时间参数 ${name}：${value}`);
  }
  return new Date(value).toISOString();
}

export function createDashboardService(deps: { db: Db; registry: RegistryService }) {
  const repo = createDashboardRepo(deps.db);

  return {
    /**
     * 序列查询：bucket 未指定时自动选粒度——跨度 > 6 小时走小时聚合，否则走原始点。
     * 默认时间窗为截止 now 的最近 24 小时。
     */
    metrics(deviceCode: string, query: MetricsQuery) {
      const device = deps.registry.getByCode(deviceCode); // 未注册设备 404
      const to = query.to ? parseIso('to', query.to) : new Date().toISOString();
      const from = query.from
        ? parseIso('from', query.from)
        : new Date(Date.parse(to) - 24 * 3600_000).toISOString();
      if (from > to) throw new AppError('INVALID_RANGE', 400, `from 晚于 to：${from} > ${to}`);
      const bucket: Bucket =
        query.bucket ?? (Date.parse(to) - Date.parse(from) > AUTO_HOUR_THRESHOLD_MS ? 'hour' : 'raw');

      const points =
        bucket === 'hour'
          ? repo.queryHourly(device.id, query.metric, hourFloor(from), to)
          : repo.queryRaw(device.id, query.metric, from, to);
      return { deviceCode, metric: query.metric, bucket, from, to, points };
    },

    /** 看板卡片：单设备各指标近 1 小时聚合 + 最新读数 */
    summary(deviceCode: string) {
      const device = deps.registry.getByCode(deviceCode);
      const since = new Date(Date.now() - 3600_000).toISOString();
      return { deviceCode, since, metrics: repo.metricSummaries(device.id, since) };
    },

    alerts(filter: { status?: AlertStatus }) {
      return repo.listAlerts(filter.status);
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
