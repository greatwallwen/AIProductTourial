import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import fastify, { type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import { openDb, type Db } from './shared/db.ts';
import { AppError } from './shared/errors.ts';
import { runMigrations } from './db/migrate.ts';
import { config } from './config.ts';
import { createCatalogService, catalogRoutes } from './modules/catalog/index.ts';
import { createApplicationService, applicationRoutes } from './modules/application/index.ts';
import { createNotifyService, notifyRoutes, type NotifyService } from './modules/notify/index.ts';
import { dashboardHtml } from './web/dashboard.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    notify: NotifyService;
  }
}

export interface BuildAppOptions {
  dbPath?: string;
  logger?: boolean;
}

/**
 * 组合根：全系统依赖图的唯一可视位置。
 * 模块间依赖只在这里连线（application 依赖 catalog 的 service 接口）。
 */
export async function buildApp(opts: BuildAppOptions = {}) {
  const dbPath = opts.dbPath ?? config.dbPath;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDb(dbPath);
  runMigrations(db);

  const app = fastify({ logger: opts.logger ?? false });
  app.decorate('db', db);
  app.addHook('onClose', async () => db.close());

  await app.register(swagger, {
    openapi: {
      info: {
        title: '政务事项申报审批系统 API',
        description: '《信息化产品系统架构设计实操教程》案例一示例工程',
        version: '1.0.0',
      },
    },
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    const fastifyErr = err as FastifyError;
    if (fastifyErr.validation) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_FAILED', message: fastifyErr.message },
      });
    }
    app.log.error(err);
    return reply.code(500).send({ error: { code: 'INTERNAL', message: '服务内部错误' } });
  });

  // 组装模块：显式注入代替框架魔法。application 依赖 catalog 与 notify（组合根是依赖图唯一可视处）。
  const catalog = createCatalogService({ db });
  const notify = createNotifyService({ db });
  const application = createApplicationService({ db, catalog, notify, divisionCode: config.divisionCode });

  await app.register(catalogRoutes(catalog), { prefix: '/api' });
  await app.register(applicationRoutes(application), { prefix: '/api' });
  await app.register(notifyRoutes(notify), { prefix: '/api' });
  app.decorate('notify', notify); // server 的定时投递用

  // 内嵌看板：单路由 HTML，无外部资源，轮询只读接口（/api/items 与 /api/applications）
  app.get('/', { schema: { hide: true } }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(dashboardHtml)
  );

  // 契约即代码：OpenAPI 文档由路由 schema 自动生成
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
