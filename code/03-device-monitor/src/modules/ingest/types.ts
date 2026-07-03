/** 告警状态集合：as const 联合类型，与 001_init.sql 的 CHECK 约束逐字一致 */
export const ALERT_STATUSES = [
  'firing', // 触发中（未确认）
  'acked', // 已确认（值班人员已知晓，仍未恢复）
  'resolved', // 已恢复（终态）
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_LEVELS = ['warning', 'critical'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const ALERT_OPS = ['>', '<'] as const;
export type AlertOp = (typeof ALERT_OPS)[number];

/** 上报的一个遥测点：ts 为 ISO 8601 文本，服务端统一规范化为 UTC */
export interface TelemetryPoint {
  deviceCode: string;
  metric: string;
  ts: string;
  value: number;
}

export interface AlertRule {
  id: number;
  deviceId: number;
  metric: string;
  op: AlertOp;
  threshold: number;
  level: AlertLevel;
  title: string;
}

export interface IngestResult {
  received: number;
  inserted: number;
  /** 重复 (device_id, metric, ts) 幂等跳过的点数 */
  duplicates: number;
  alertsFired: Array<{
    alertId: number;
    deviceCode: string;
    metric: string;
    level: AlertLevel;
    title: string;
    value: number;
  }>;
  alertsResolved: Array<{ alertId: number; deviceCode: string; metric: string; title: string }>;
}
