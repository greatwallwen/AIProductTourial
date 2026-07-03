import type { FastifyPluginAsync } from 'fastify';
import type { NotifyService } from './service.ts';

export function notifyRoutes(service: NotifyService): FastifyPluginAsync {
  return async (app) => {
    // 触发一次投递（生产由 setInterval 驱动，这里供运维/演示手动触发）
    app.post('/notify/dispatch', {
      schema: { tags: ['notify'], summary: '投递到期的出站消息' },
    }, async () => service.dispatchDue());
  };
}
