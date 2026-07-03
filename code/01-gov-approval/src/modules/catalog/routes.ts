import type { FastifyPluginAsync } from 'fastify';
import type { CatalogService } from './service.ts';

export function catalogRoutes(service: CatalogService): FastifyPluginAsync {
  return async (app) => {
    app.get('/items', {
      schema: { tags: ['catalog'], summary: '事项目录列表' },
    }, async () => service.list());

    app.get<{ Params: { code: string } }>('/items/:code', {
      schema: {
        tags: ['catalog'],
        summary: '按事项编码查询',
        params: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
      },
    }, async (req) => service.getByCode(req.params.code));
  };
}
