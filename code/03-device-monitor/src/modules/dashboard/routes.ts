import type { FastifyPluginAsync } from 'fastify';
import type { DashboardService } from './service.ts';
import { BUCKETS } from './types.ts';
import type { AlertStatus, Bucket } from './types.ts';

export function dashboardRoutes(service: DashboardService): FastifyPluginAsync {
  return async (app) => {
    app.get<{
      Params: { code: string };
      Querystring: { metric: string; from?: string; to?: string; bucket?: Bucket };
    }>('/devices/:code/metrics', {
      schema: {
        tags: ['dashboard'],
        summary: '序列查询（bucket 未指定时按跨度自动选粒度）',
        params: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
        querystring: {
          type: 'object',
          required: ['metric'],
          additionalProperties: false,
          properties: {
            metric: { type: 'string', minLength: 1 },
            from: { type: 'string' },
            to: { type: 'string' },
            bucket: { type: 'string', enum: [...BUCKETS] },
          },
        },
      },
    }, async (req) => service.metrics(req.params.code, req.query));

    app.get<{ Params: { code: string } }>('/devices/:code/summary', {
      schema: {
        tags: ['dashboard'],
        summary: '看板卡片：各指标近 1 小时聚合 + 最新读数',
        params: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
      },
    }, async (req) => service.summary(req.params.code));

    app.get<{ Querystring: { status?: AlertStatus } }>('/alerts', {
      schema: {
        tags: ['dashboard'],
        summary: '告警查询（可按状态过滤）',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['firing', 'acked', 'resolved'] },
          },
        },
      },
    }, async (req) => service.alerts(req.query));
  };
}
