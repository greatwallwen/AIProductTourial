import type { FastifyPluginAsync } from 'fastify';
import type { RegistryService } from './service.ts';

export function registryRoutes(service: RegistryService): FastifyPluginAsync {
  return async (app) => {
    app.get('/devices', {
      schema: { tags: ['registry'], summary: '设备档案列表' },
    }, async () => service.list());

    app.get<{ Params: { code: string } }>('/devices/:code', {
      schema: {
        tags: ['registry'],
        summary: '按设备编码查询档案',
        params: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
      },
    }, async (req) => service.getByCode(req.params.code));
  };
}
