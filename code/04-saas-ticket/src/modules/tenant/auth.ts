import type { onRequestHookHandler } from 'fastify';
import { AppError } from '../../shared/errors.ts';
import type { TenantService } from './service.ts';

/**
 * 隔离双保险之一：鉴权钩子。
 * 挂在工单子作用域（app.ts）的 onRequest 上，X-API-Key → {tenantId, tenantCode} 写入 request；
 * 失败一律 401 UNAUTHORIZED，绝无放行路径——安全边界由 fastify encapsulation 表达。
 */
export function createApiKeyAuthHook(service: TenantService): onRequestHookHandler {
  return async (req) => {
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new AppError('UNAUTHORIZED', 401, '缺少 X-API-Key 请求头');
    }
    const identity = service.authenticate(apiKey);
    if (!identity) {
      throw new AppError('UNAUTHORIZED', 401, 'API Key 无效');
    }
    req.tenant = identity;
  };
}
