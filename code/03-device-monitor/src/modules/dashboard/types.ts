/**
 * dashboard 与 ingest 互不依赖（写读分离的模块边界——未来的进程边界）。
 * 因此告警状态联合类型在此有意重复声明：两侧真正共享的契约是数据库 schema，
 * 不是代码。复制约定，而不是复制抽象（附录 C）。
 */
export type AlertStatus = 'firing' | 'acked' | 'resolved';

export const BUCKETS = ['raw', 'hour'] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface RawPoint {
  ts: string;
  value: number;
}

export interface HourlyPoint {
  hourTs: string;
  avg: number;
  min: number;
  max: number;
  cnt: number;
}

export interface MetricsQuery {
  metric: string;
  from?: string;
  to?: string;
  bucket?: Bucket;
}

export interface AlertView {
  id: number;
  deviceCode: string;
  deviceName: string;
  metric: string;
  op: string;
  threshold: number;
  level: string;
  title: string;
  status: AlertStatus;
  firstTs: string;
  lastTs: string;
  peakValue: number;
}

/** 单设备单指标的近 1 小时快照（看板卡片用） */
export interface MetricSummary {
  metric: string;
  cnt: number;
  avg: number;
  min: number;
  max: number;
  last: number;
  lastTs: string;
}
