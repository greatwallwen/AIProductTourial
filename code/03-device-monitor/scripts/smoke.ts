import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 冒烟脚本：起真实 HTTP 服务，按业务剧本打请求，打印「curl 命令 + 实际响应」实录。
 * 教程正文引用的请求/响应全部复制自本脚本输出，不手写。
 */
const ROOT = join(import.meta.dirname, '..');
const DB = join(ROOT, 'data', 'smoke.db');
const PORT = Number(process.env.SMOKE_PORT ?? 3003);
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

// 1) 全新库 + 种子（含最近 2 小时越限注入 → 2 条 firing 告警）
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
      const r = await fetch(`${BASE}/api/devices`);
      ready = r.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (serverExited) throw new Error(`服务启动即退出（端口 ${PORT} 可能被占用，可设 SMOKE_PORT 覆盖）`);
  if (!ready) throw new Error('服务未在 5s 内就绪');

  console.log('===== 冒烟实录：液压系统状态监测系统 =====');
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  // 场景 1：设备档案列表
  const devices = (await call('GET', '/api/devices', null, 200)) as unknown as Array<{ deviceCode: string }>;
  if (devices.length !== 3) { failures++; console.error('✖ 设备档案应有 3 台'); }

  // 场景 2：上报一批正常遥测（主泵振动，无规则序列，不触发告警）
  const normalBatch = [
    { deviceCode: 'HYD-PMP-01', metric: 'pump_vibration', ts: iso(90_000), value: 0.61 },
    { deviceCode: 'HYD-PMP-01', metric: 'pump_vibration', ts: iso(30_000), value: 0.63 },
  ];
  const ok = await call('POST', '/api/telemetry', normalBatch, 201);
  if (ok.inserted !== 2 || (ok.alertsFired as unknown[]).length !== 0) {
    failures++; console.error('✖ 正常批次应插入 2 点且不触发告警');
  }

  // 场景 3：原样重发同一批 → 幂等跳过，不重复累计
  const dup = await call('POST', '/api/telemetry', normalBatch, 201);
  if (dup.inserted !== 0 || dup.duplicates !== 2) {
    failures++; console.error('✖ 重发批次应全部幂等跳过');
  }

  // 场景 4：上报越限遥测 → 触发新告警（主回路压力 > 130 bar warning）
  const fired = await call(
    'POST',
    '/api/telemetry',
    [{ deviceCode: 'HYD-PMP-01', metric: 'system_pressure', ts: iso(20_000), value: 135.4 }],
    201
  );
  const firedAlerts = fired.alertsFired as Array<{ alertId: number; level: string }>;
  if (firedAlerts.length !== 1 || firedAlerts[0]!.level !== 'warning') {
    failures++; console.error('✖ 越限点应触发 1 条 warning 告警');
  }
  const newAlertId = firedAlerts[0]!.alertId;

  // 场景 5：firing 告警列表（种子注入 2 条 + 刚触发 1 条）
  const firing = (await call('GET', '/api/alerts?status=firing', null, 200)) as unknown as Array<{ level: string }>;
  if (firing.length !== 3) { failures++; console.error('✖ firing 告警应为 3 条（种子 2 + 新触发 1）'); }

  // 场景 6：值班确认 firing → acked
  await call('POST', `/api/alerts/${newAlertId}/ack`, {}, 200);

  // 场景 7：上报回落值 → acked 告警自动 resolved
  const recovered = await call(
    'POST',
    '/api/telemetry',
    [{ deviceCode: 'HYD-PMP-01', metric: 'system_pressure', ts: iso(5_000), value: 108.2 }],
    201
  );
  if ((recovered.alertsResolved as unknown[]).length !== 1) {
    failures++; console.error('✖ 回落点应自动 resolve 1 条告警');
  }
  const resolved = (await call('GET', '/api/alerts?status=resolved', null, 200)) as unknown as unknown[];
  if (resolved.length !== 1) { failures++; console.error('✖ resolved 告警应为 1 条'); }

  // 场景 8：聚合查询（bucket=hour，avg 由 sum/cnt 得出）——只打印首尾各 2 桶
  const agg = (await fetch(
    `${BASE}/api/devices/HYD-CLR-01/metrics?metric=oil_temperature&bucket=hour`
  ).then((r) => r.json())) as { bucket: string; points: Array<{ hourTs: string; avg: number }> };
  console.log(`\n$ curl -s "${BASE}/api/devices/HYD-CLR-01/metrics?metric=oil_temperature&bucket=hour"`);
  console.log('# HTTP 200（points 仅摘录首尾各 2 桶）');
  console.log(JSON.stringify(
    { bucket: agg.bucket, totalBuckets: agg.points.length, points: [...agg.points.slice(0, 2), ...agg.points.slice(-2)] },
    null, 2
  ));
  if (agg.bucket !== 'hour' || agg.points.length < 20) {
    failures++; console.error('✖ 24h 窗口的小时聚合应有 20+ 桶');
  }
  const lastBucket = agg.points.at(-1)!;
  if (lastBucket.avg <= 49) { failures++; console.error('✖ 最近一桶均值应反映冷却器失效段（油温 >49 °C）'); }

  // 场景 9：看板卡片数据源（近 1 小时聚合 + 最新读数）
  const summary = await call('GET', '/api/devices/HYD-CLR-01/summary', null, 200);
  const ce = (summary.metrics as Array<{ metric: string; last: number }>).find(
    (m) => m.metric === 'cooling_efficiency'
  );
  if (!ce || ce.last >= 30) { failures++; console.error('✖ 冷却效率最新读数应处于失效段（<30 %）'); }

  // 场景 10：契约即代码——OpenAPI 由路由 schema 生成
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
console.log('\n===== 冒烟通过：10 个场景全部符合预期 =====');
