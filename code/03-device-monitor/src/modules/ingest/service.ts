import type { Db } from '../../shared/db.ts';
import { withTransaction } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import type { RegistryService } from '../registry/index.ts';
import { createIngestRepo } from './repo.ts';
import type { IngestResult, TelemetryPoint } from './types.ts';

/** ts 截断到整点：小时聚合桶的键 */
export function hourOf(ts: string): string {
  const d = new Date(ts);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function createIngestService(deps: { db: Db; registry: RegistryService }) {
  const repo = createIngestRepo(deps.db);

  return {
    /**
     * 批量写入：整批一个事务（全部成功或全部回滚）。每个新点做三件事——
     * (a) 插入 raw（幂等：命中重复即跳过，且不重复累计 hourly、不重复评估告警）
     * (b) 增量 UPSERT 小时聚合
     * (c) 逐条评估该序列的告警规则（有状态：新建 firing / 推进 last_ts 与 peak / 回落 resolved）
     */
    ingestBatch(points: TelemetryPoint[]): IngestResult {
      return withTransaction(deps.db, () => {
        const result: IngestResult = {
          received: points.length,
          inserted: 0,
          duplicates: 0,
          alertsFired: [],
          alertsResolved: [],
        };
        for (const p of points) {
          const device = deps.registry.getByCode(p.deviceCode); // 未注册设备 404，整批回滚
          if (Number.isNaN(Date.parse(p.ts))) {
            throw new AppError('INVALID_TS', 400, `无法解析的时间戳：${p.ts}`, { point: { ...p } });
          }
          const ts = new Date(p.ts).toISOString(); // 规范化为 UTC ISO 文本，保证幂等键与字典序一致

          const changes = repo.insertRaw(device.id, p.metric, ts, p.value);
          if (changes === 0) {
            result.duplicates++; // 重复点：hourly 不累计、告警不评估
            continue;
          }
          result.inserted++;
          repo.upsertHourly(device.id, p.metric, hourOf(ts), p.value);

          for (const rule of repo.listRules(device.id, p.metric)) {
            const breached = rule.op === '>' ? p.value > rule.threshold : p.value < rule.threshold;
            const open = repo.getOpenAlert(rule.id);
            if (breached) {
              if (open) {
                // 持续越限：推进 last_ts，peak 取更劣值（> 规则取更大，< 规则取更小）
                const peak =
                  rule.op === '>' ? Math.max(open.peak_value, p.value) : Math.min(open.peak_value, p.value);
                repo.touchAlert(open.id, ts > open.last_ts ? ts : open.last_ts, peak);
              } else {
                const alertId = repo.insertAlert({ ruleId: rule.id, deviceId: device.id, ts, value: p.value });
                result.alertsFired.push({
                  alertId,
                  deviceCode: p.deviceCode,
                  metric: p.metric,
                  level: rule.level,
                  title: rule.title,
                  value: p.value,
                });
              }
            } else if (open && ts >= open.last_ts) {
              // 回落到阈值内：firing 或 acked 均自动 resolved。
              // 时序守卫：仅当这条正常读数不早于最近一次越限（last_ts）时才消警——
              // 弱网乱序补传时，迟到的旧读数不能消掉由更新越限点建立的告警（见测试"乱序补传"）。
              repo.setStatus(open.id, 'resolved', ts);
              result.alertsResolved.push({
                alertId: open.id,
                deviceCode: p.deviceCode,
                metric: p.metric,
                title: rule.title,
              });
            }
          }
        }
        return result;
      });
    },

    /** 值班确认：firing → acked。acked 后值回落同样会被自动 resolved。 */
    ack(alertId: number) {
      const alert = repo.getAlertById(alertId);
      if (!alert) throw new AppError('ALERT_NOT_FOUND', 404, `告警不存在：${alertId}`);
      if (alert.status !== 'firing') {
        throw new AppError('ILLEGAL_TRANSITION', 409, `当前状态 ${alert.status} 不允许确认`, {
          currentStatus: alert.status,
        });
      }
      repo.setStatus(alertId, 'acked');
      return { id: alertId, status: 'acked' as const };
    },
  };
}

export type IngestService = ReturnType<typeof createIngestService>;
