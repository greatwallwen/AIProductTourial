import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { apiRoutes } from './routes/api.ts';
/** 组合根：注册 API 路由 + 托管前端静态包（一服务 = API + 前端，把全部案例串起来）。 */
export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(apiRoutes);
  const webDist = join(import.meta.dirname, '..', 'web', 'dist');
  if (existsSync(webDist)) await app.register(fastifyStatic, { root: webDist, prefix: '/' });
  return app;
}

export function isDirectRun(moduleUrl = import.meta.url, entry = process.argv[1]) {
  return Boolean(entry) && moduleUrl === pathToFileURL(resolve(entry)).href;
}

if (isDirectRun()) {
  const app = await buildApp();
  const port = Number(process.env.PORT || 5200);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`pm-kb-server on http://localhost:${port}  (API + web)`);
}
