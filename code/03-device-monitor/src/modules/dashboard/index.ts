/** dashboard 模块唯一公共出口：聚合查询 + 告警查询（只读）。与 ingest 互不依赖。 */
export { createDashboardService, type DashboardService } from './service.ts';
export { dashboardRoutes } from './routes.ts';
export { BUCKETS, type Bucket, type AlertStatus, type AlertView, type MetricSummary } from './types.ts';
