/** ingest 模块唯一公共出口：遥测接入 + 告警评估（只写）。与 dashboard 互不依赖。 */
export { createIngestService, type IngestService, hourOf } from './service.ts';
export { ingestRoutes } from './routes.ts';
export {
  ALERT_STATUSES,
  ALERT_LEVELS,
  ALERT_OPS,
  type AlertStatus,
  type AlertLevel,
  type AlertOp,
  type TelemetryPoint,
  type IngestResult,
} from './types.ts';
