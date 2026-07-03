import type { FastifyPluginAsync } from 'fastify';
import type { TenantService } from './service.ts';
import { PLANS } from './types.ts';
import type { RegisterInput } from './types.ts';

export function tenantRoutes(service: TenantService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: RegisterInput }>('/tenants/register', {
      schema: {
        tags: ['tenant'],
        summary: '租户注册开通（返回明文 API Key，仅此一次）',
        body: {
          type: 'object',
          required: ['companyName', 'tenantCode', 'adminName', 'adminEmail'],
          additionalProperties: false,
          properties: {
            companyName: { type: 'string', minLength: 2 },
            tenantCode: { type: 'string', pattern: '^[A-Z][A-Z0-9]{2,15}$' },
            adminName: { type: 'string', minLength: 1 },
            adminEmail: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
            plan: { type: 'string', enum: [...PLANS] },
          },
        },
      },
    }, async (req, reply) => {
      const result = service.register(req.body);
      return reply.code(201).send(result);
    });
  };
}
