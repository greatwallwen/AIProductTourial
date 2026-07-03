import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import fastify, { type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import { openDb, withTransaction, type Db } from './shared/db.ts';
import { AppError } from './shared/errors.ts';
import { runMigrations } from './db/migrate.ts';
import { config } from './config.ts';
import { createContractService, contractRoutes } from './modules/contract/index.ts';
import { createApprovalService, createApprovalRepo, approvalRoutes } from './modules/approval/index.ts';
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
 * 模块间依赖只在这里连线：approval 的两个端口（仓储、合同网关）
 * 分别由 SQLite 仓储实现与 contract service 满足——service 本身不知道 SQLite 的存在。
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
        title: '企业合同管理系统 API',
        description: '《信息化产品系统架构设计实操教程》案例二示例工程',
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

  // 组装模块：显式注入代替框架魔法（approval 依赖 contract 的 service，只走 index.ts）
  const contract = createContractService({ db });
  const approval = createApprovalService({
    repo: createApprovalRepo(db),
    contracts: contract,
    tx: (fn) => withTransaction(db, fn),
  });

  await app.register(contractRoutes(contract), { prefix: '/api' });
  await app.register(approvalRoutes(approval), { prefix: '/api' });

  // 内嵌看板：单路由 HTML，无外部资源，轮询只读接口（/api/contracts 与 /api/contracts/reminders）
  app.get('/', { schema: { hide: true } }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(dashboardHtml)
  );

  // 契约即代码：OpenAPI 文档由路由 schema 自动生成
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
