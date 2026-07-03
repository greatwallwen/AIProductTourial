import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 冒烟脚本：起真实 HTTP 服务，按业务剧本打请求，打印「curl 命令 + 实际响应」实录。
 * 教程正文引用的请求/响应全部复制自本脚本输出，不手写。
 */
const ROOT = join(import.meta.dirname, '..');
const DB = join(ROOT, 'data', 'smoke.db');
const PORT = Number(process.env.SMOKE_PORT ?? 3001);
const BASE = `http://localhost:${PORT}`;

/** 等子进程真正退出（释放 WAL/SHM 句柄）再删库，避免竞态；Windows 上 unlink 打开中的文件会 EBUSY。 */
function waitExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', () => resolve());
  });
}

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

function printExchange(method: string, path: string, body: unknown, status: number, json: unknown) {
  const curl =
    method === 'GET'
      ? `$ curl -s "${BASE}${path}"`
      : `$ curl -s -X ${method} "${BASE}${path}" \\\n    -H 'Content-Type: application/json' \\\n    -d '${JSON.stringify(body)}'`;
  console.log(`\n${curl}`);
  console.log(`# HTTP ${status}`);
  console.log(JSON.stringify(json, null, 2));
}

async function call(
  method: string,
  path: string,
  body: unknown,
  expectStatus: number
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  printExchange(method, path, body, res.status, json);
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
      const r = await fetch(`${BASE}/api/items`);
      ready = r.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (serverExited) throw new Error(`服务启动即退出（端口 ${PORT} 可能被占用，可设 SMOKE_PORT 覆盖）`);
  if (!ready) throw new Error('服务未在 5s 内就绪');

  console.log('===== 冒烟实录：政务事项申报审批系统 =====');

  // 场景 1：查询事项目录
  const items = (await call('GET', '/api/items', null, 200)) as unknown as Array<{ itemCode: string }>;
  if (items.length !== 5) { failures++; console.error('✖ 事项目录应有 5 项'); }

  // 场景 2：正常申报
  const submission = {
    itemCode: 'SCJG-XK-001',
    applicantName: '上海云澜餐饮有限公司',
    applicantIdNo: '91310104MA1QC***XX',
    applicantPhone: '021-6420****',
    materials: [
      { materialName: '营业执照复印件', fileRef: 'file://demo/yyzz.pdf' },
      { materialName: '经营场所平面布局图', fileRef: 'file://demo/layout.pdf' },
      { materialName: '食品安全管理制度', fileRef: 'file://demo/zhidu.pdf' },
      { materialName: '从业人员健康证明', fileRef: 'file://demo/health.pdf' },
    ],
  };
  const created = await call('POST', '/api/applications', submission, 201);
  const applyNo = created.applyNo as string;

  // 场景 3：缺材料被拒（数据驱动校验）
  await call(
    'POST',
    '/api/applications',
    { ...submission, materials: submission.materials.slice(0, 2) },
    400
  );

  // 场景 4：非法迁移被状态机拒绝（附允许动作）
  await call(
    'POST',
    `/api/applications/${applyNo}/actions`,
    { action: 'approve', operator: '科长-王建国' },
    409
  );

  // 场景 5：合法流转走完全流程
  for (const [action, operator, opinion] of [
    ['accept', '窗口-李芳', '材料齐全，予以受理'],
    ['start_review', '科员-赵磊', undefined],
    ['approve', '科长-王建国', '符合《食品经营许可和备案管理办法》许可条件'],
    ['conclude', '窗口-李芳', undefined],
  ] as const) {
    await call(
      'POST',
      `/api/applications/${applyNo}/actions`,
      { action, operator, ...(opinion ? { opinion } : {}) },
      200
    );
  }

  // 场景 6：详情含全程留痕
  const detail = await call('GET', `/api/applications/${applyNo}`, null, 200);
  const logs = detail.logs as unknown[];
  if (logs.length !== 5) { failures++; console.error('✖ 应有 5 条流转留痕'); }

  // 场景 7：超期预警（种子中回拨 15 天的在办件）
  const overdue = (await call('GET', '/api/applications?overdue=true', null, 200)) as unknown as Array<{
    applyNo: string;
    overdueDays: number;
  }>;
  if (overdue.length !== 1 || overdue[0]!.overdueDays < 5) {
    failures++;
    console.error('✖ 超期预警应命中 1 件且超期天数 >= 5');
  }

  // 场景 8：办结触发的短信在出站表里（pending），触发投递后转 sent
  const dispatched = await call('POST', '/api/notify/dispatch', null, 200);
  if ((dispatched.sent as number) < 1) {
    failures++;
    console.error('✖ 办结产生的出站短信应被投递为 sent');
  }

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
