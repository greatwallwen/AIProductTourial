import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { devSeedApiKey } from '../src/db/seed-key.ts';

/**
 * 冒烟脚本：起真实 HTTP 服务，按业务剧本打请求，打印「curl 命令 + 实际响应」实录。
 * 教程正文引用的请求/响应全部复制自本脚本输出，不手写。
 */
const ROOT = join(import.meta.dirname, '..');
const DB = join(ROOT, 'data', 'smoke.db');
const PORT = Number(process.env.SMOKE_PORT ?? 3004);
const BASE = `http://localhost:${PORT}`;

/** 等子进程真正退出（释放 WAL/SHM 句柄）再删库，避免竞态；Windows 上 unlink 打开中的文件会 EBUSY。 */
function waitExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', () => resolve());
  });
}

/** 开发种子专用 Key：与 src/db/seed.ts 共用 seed-key.ts 的同一派生，无需从种子输出里抄 */
const KEY_SUPABASE = devSeedApiKey('SUPABASE');
const KEY_PRISMA = devSeedApiKey('PRISMA');

let failures = 0;

function sh(script: string, env: Record<string, string>) {
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    throw new Error(`预备步骤失败：${script}`);
  }
}

function printExchange(
  method: string,
  path: string,
  body: unknown,
  status: number,
  json: unknown,
  apiKey?: string
) {
  const lines = [`$ curl -s${method === 'GET' ? '' : ` -X ${method}`} "${BASE}${path}"`];
  if (apiKey) lines.push(`    -H 'X-API-Key: ${apiKey}'`);
  if (body) lines.push(`    -H 'Content-Type: application/json'`, `    -d '${JSON.stringify(body)}'`);
  console.log(`\n${lines.join(' \\\n')}`);
  console.log(`# HTTP ${status}`);
  console.log(JSON.stringify(json, null, 2));
}

async function call(
  method: string,
  path: string,
  body: unknown,
  expectStatus: number,
  apiKey?: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  printExchange(method, path, body, res.status, json, apiKey);
  if (res.status !== expectStatus) {
    failures++;
    console.error(`✖ 期望 HTTP ${expectStatus}，实际 ${res.status}`);
  }
  return json;
}

// 1) 全新库 + 种子
rmSync(DB, { force: true });
sh('src/db/migrate.ts', { DB_PATH: DB });
sh('src/db/seed.ts', { DB_PATH: DB });

// 2) 起服务
const server = spawn(process.execPath, ['src/server.ts'], {
  cwd: ROOT,
  env: { ...process.env, DB_PATH: DB, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'inherit'],
});
let serverExited = false;
server.once('exit', (code) => { serverExited = true; if (code) console.error(`✖ 服务进程提前退出，code=${code}`); });
try {
  let ready = false;
  for (let i = 0; i < 50 && !ready && !serverExited; i++) {
    try {
      const r = await fetch(`${BASE}/openapi.json`);
      ready = r.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (serverExited) throw new Error(`服务启动即退出（端口 ${PORT} 可能被占用，可设 SMOKE_PORT 覆盖）`);
  if (!ready) throw new Error('服务未在 5s 内就绪');

  console.log('===== 冒烟实录：SaaS 多租户工单系统 =====');

  // 场景 1：注册新租户——明文 Key 只在这个响应里出现一次
  const registered = await call(
    'POST',
    '/api/tenants/register',
    {
      companyName: '苏州新创智能科技有限公司',
      tenantCode: 'XINCHUANG',
      adminName: '顾天成',
      adminEmail: 'gutc@xinchuang.example.com',
    },
    201
  );
  const keyXinchuang = registered.apiKey as string;

  // 场景 2：★高光★ 同一 URL、两把 Key——隔离双保险的直接可见证据
  console.log('\n----- 高光：同一 URL /api/tickets/SUPABASE-0001，两个租户的 Key -----');
  console.log('--- 用 SUPABASE 自己的 Key（200）：');
  await call('GET', '/api/tickets/SUPABASE-0001', null, 200, KEY_SUPABASE);
  console.log('\n--- 用 PRISMA 的 Key 打同一 URL（404，而非 403——不泄露资源存在性）：');
  await call('GET', '/api/tickets/SUPABASE-0001', null, 404, KEY_PRISMA);

  // 场景 3：无 Key 访问工单域，401 挡在子作用域门口
  await call('GET', '/api/tickets', null, 401);

  // 场景 4：新租户建单——注册事务里的发号器立即可用，首单即 XINCHUANG-0001
  const created = await call(
    'POST',
    '/api/tickets',
    { title: '接入企业微信告警通知', priority: 'medium', createdBy: 'gutc@xinchuang.example.com' },
    201,
    keyXinchuang
  );
  const ticketNo = created.ticketNo as string;
  if (ticketNo !== 'XINCHUANG-0001') { failures++; console.error('✖ 新租户首单应为 XINCHUANG-0001'); }

  // 场景 5：列表隔离——SUPABASE 的 Key 只看得见 SUPABASE 的工单（12 单，源自该仓 12 条 issue）
  const list = (await call('GET', '/api/tickets', null, 200, KEY_SUPABASE)) as unknown as Array<{ ticketNo: string }>;
  if (list.length !== 12 || !list.every((t) => t.ticketNo.startsWith('SUPABASE-'))) {
    failures++;
    console.error('✖ SUPABASE 列表应恰好 12 单且全部为本租户');
  }
  const inProgress = (await call('GET', '/api/tickets?status=in_progress', null, 200, KEY_SUPABASE)) as unknown as Array<{ ticketNo: string }>;
  if (inProgress.length !== 6 || !inProgress.every((t) => t.ticketNo.startsWith('SUPABASE-'))) {
    failures++;
    console.error('✖ 状态筛选（in_progress）应为 6 单且全部为本租户');
  }

  // 场景 6：非法迁移被状态机拒绝——open 直接 close，409 附允许动作
  await call(
    'POST',
    `/api/tickets/${ticketNo}/transition`,
    { action: 'close', actorEmail: 'gutc@xinchuang.example.com' },
    409,
    keyXinchuang
  );

  // 场景 7：合法流转走到 closed
  for (const [action, note] of [
    ['start', '已联系企微服务商开通接口'],
    ['resolve', '告警群已建，机器人推送验证通过'],
    ['close', undefined],
  ] as const) {
    await call(
      'POST',
      `/api/tickets/${ticketNo}/transition`,
      { action, actorEmail: 'gutc@xinchuang.example.com', ...(note ? { note } : {}) },
      200,
      keyXinchuang
    );
  }

  // 场景 8：详情含完整事件流（created + 3 次流转 = 4 条）
  const detail = await call('GET', `/api/tickets/${ticketNo}`, null, 200, keyXinchuang);
  const events = detail.events as unknown[];
  if (events.length !== 4) { failures++; console.error('✖ 应有 4 条事件'); }

  // 场景 9：契约即代码——OpenAPI 由路由 schema 生成
  const openapi = await fetch(`${BASE}/openapi.json`).then((r) => r.json()) as { openapi: string; paths: Record<string, unknown> };
  console.log(`\n$ curl -s "${BASE}/openapi.json" | jq '.openapi, (.paths | keys)'`);
  console.log(JSON.stringify({ openapi: openapi.openapi, paths: Object.keys(openapi.paths) }, null, 2));
} finally {
  server.kill();
  await waitExit(server); // 等进程真正退出、释放 sqlite 文件句柄，再删库
  rmSync(DB, { force: true });
  rmSync(`${DB}-wal`, { force: true });
  rmSync(`${DB}-shm`, { force: true });
}

if (failures > 0) {
  console.error(`\n冒烟失败：${failures} 处断言未通过`);
  process.exit(1);
}
console.log('\n===== 冒烟通过：9 个场景全部符合预期 =====');
