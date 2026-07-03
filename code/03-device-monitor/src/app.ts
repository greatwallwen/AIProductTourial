import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import fastify, { type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import { openDb, type Db } from './shared/db.ts';
import { AppError } from './shared/errors.ts';
import { runMigrations } from './db/migrate.ts';
import { config } from './config.ts';
import { createRegistryService, registryRoutes } from './modules/registry/index.ts';
import { createIngestService, ingestRoutes } from './modules/ingest/index.ts';
import { createDashboardService, dashboardRoutes } from './modules/dashboard/index.ts';
import { dashboardHtml } from './web/dashboard.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export interface BuildAppOptions {
  dbPath?: string;
  logger?: boolean;
}

/**
 * 组合根：全系统依赖图的唯一可视位置。
 * ingest（只写）与 dashboard（只读）互不依赖——写读分离的模块边界，未来的进程边界；
 * 两者都只依赖 registry 的 service 接口，连线只发生在这里。
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
        title: '液压系统状态监测 API',
        description: '《信息化产品系统架构设计实操教程》案例三示例工程',
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

  // 组装模块：显式注入代替框架魔法
  const registry = createRegistryService({ db });
  const ingest = createIngestService({ db, registry });
  const dashboard = createDashboardService({ db, registry });

  await app.register(registryRoutes(registry), { prefix: '/api' });
  await app.register(ingestRoutes(ingest), { prefix: '/api' });
  await app.register(dashboardRoutes(dashboard), { prefix: '/api' });

  // 内嵌看板：单路由 HTML，无外部资源，轮询只读接口
  app.get('/', { schema: { hide: true } }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(dashboardHtml)
  );

  // 契约即代码：OpenAPI 文档由路由 schema 自动生成
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
