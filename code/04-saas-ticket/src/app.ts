import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import fastify, { type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import { openDb, type Db } from './shared/db.ts';
import { AppError } from './shared/errors.ts';
import { runMigrations } from './db/migrate.ts';
import { config } from './config.ts';
import { createTenantService, tenantRoutes, createApiKeyAuthHook, type TenantIdentity } from './modules/tenant/index.ts';
import { createTicketService, ticketRoutes } from './modules/ticket/index.ts';
import { dashboardHtml } from './web/dashboard.ts';
import { devSeedApiKey } from './db/seed-key.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
  interface FastifyRequest {
    /** 鉴权钩子写入的租户身份；只在鉴权子作用域内的路由可信赖其存在 */
    tenant: TenantIdentity;
  }
}

export interface BuildAppOptions {
  dbPath?: string;
  logger?: boolean;
}

/**
 * 组合根：全系统依赖图的唯一可视位置。
 * 路由分两个作用域：公共域（租户注册）与鉴权域（工单）——
 * 工单路由整体注册在挂了 onRequest 鉴权钩子的子作用域内，安全边界由 fastify encapsulation 表达。
 */
export async function buildApp(opts: BuildAppOptions = {}) {
  const dbPath = opts.dbPath ?? config.dbPath;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDb(dbPath);
  runMigrations(db);

  const app = fastify({ logger: opts.logger ?? false });
  app.decorate('db', db);
  app.decorateRequest('tenant');
  app.addHook('onClose', async () => db.close());

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SaaS 多租户工单系统 API',
        description: '《信息化产品系统架构设计实操教程》案例四示例工程',
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
  const tenant = createTenantService({ db });
  const ticket = createTicketService({ db });

  // 公共域：注册开通不需要 Key
  await app.register(tenantRoutes(tenant), { prefix: '/api' });

  // 鉴权域：工单路由整体挂在鉴权子作用域内，域内任何路由都不可能绕过 X-API-Key
  await app.register(async (secured) => {
    secured.addHook('onRequest', createApiKeyAuthHook(tenant));
    await secured.register(ticketRoutes(ticket));
  }, { prefix: '/api' });

  // 内嵌看板：单路由 HTML，无外部资源，轮询只读接口 /api/tickets。
  // ⚠ 本 `/` 页面是「本地演示看板」：它把租户 SUPABASE 的开发种子 API Key 直接烤进页面，
  //    以便无需手工传 X-API-Key 即可截图演示。生产环境绝不可这样做——密钥不得下发到浏览器，
  //    页面应改由登录会话/后端代理携带租户凭证。此处仅为本地演示便利。
  const demoKey = devSeedApiKey('SUPABASE');
  app.get('/', { schema: { hide: true } }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(dashboardHtml(demoKey))
  );

  // 契约即代码：OpenAPI 文档由路由 schema 自动生成
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
