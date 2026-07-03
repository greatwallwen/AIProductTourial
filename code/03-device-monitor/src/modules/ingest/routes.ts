import type { FastifyPluginAsync } from 'fastify';
import type { IngestService } from './service.ts';
import type { TelemetryPoint } from './types.ts';

export function ingestRoutes(service: IngestService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: TelemetryPoint[] }>('/telemetry', {
      schema: {
        tags: ['ingest'],
        summary: '批量上报遥测（整批一个事务，重复点幂等跳过）',
        body: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['deviceCode', 'metric', 'ts', 'value'],
            additionalProperties: false,
            properties: {
              deviceCode: { type: 'string', minLength: 1 },
              metric: { type: 'string', minLength: 1 },
              ts: { type: 'string', minLength: 1 },
              value: { type: 'number' },
            },
          },
        },
      },
    }, async (req, reply) => {
      const result = service.ingestBatch(req.body);
      return reply.code(201).send(result);
    });

    app.post<{ Params: { id: number } }>('/alerts/:id/ack', {
      schema: {
        tags: ['ingest'],
        summary: '确认告警（firing → acked）',
        params: {
          type: 'object',
          properties: { id: { type: 'integer', minimum: 1 } },
          required: ['id'],
        },
      },
    }, async (req) => service.ack(req.params.id));
  };
}
