import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 冒烟脚本：起真实 HTTP 服务，按业务剧本打请求，打印「curl 命令 + 实际响应」实录。
 * 教程正文引用的请求/响应全部复制自本脚本输出，不手写。
 */
const ROOT = join(import.meta.dirname, '..');
const DB = join(ROOT, 'data', 'smoke.db');
const PORT = Number(process.env.SMOKE_PORT ?? 3002);
const BASE = `http://localhost:${PORT}`;

/** 等子进程真正退出（释放 WAL/SHM 句柄）再删库，避免竞态；Windows 上 unlink 打开中的文件会 EBUSY。 */
function waitExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', () => resolve());
  });
}
const YEAR = new Date().getFullYear();

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
      : body
        ? `$ curl -s -X ${method} "${BASE}${path}" \\\n    -H 'Content-Type: application/json' \\\n    -d '${JSON.stringify(body)}'`
        : `$ curl -s -X ${method} "${BASE}${path}"`;
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

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

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
      const r = await fetch(`${BASE}/api/contracts`);
      ready = r.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (serverExited) throw new Error(`服务启动即退出（端口 ${PORT} 可能被占用，可设 SMOKE_PORT 覆盖）`);
  if (!ready) throw new Error('服务未在 5s 内就绪');

  console.log('===== 冒烟实录：企业合同管理系统 =====');

  // 场景 1：合同台账（expired 为查询时派生，库内仍是 active）
  const ledger = (await call('GET', '/api/contracts', null, 200)) as unknown as Array<{
    contractNo: string;
    status: string;
    derivedStatus: string;
  }>;
  if (ledger.length !== 6) { failures++; console.error('✖ 台账应有 6 份合同'); }
  const erp = ledger.find((c) => c.contractNo === `HT-${YEAR}-0005`);
  if (!erp || erp.status !== 'active' || erp.derivedStatus !== 'expired') {
    failures++;
    console.error('✖ 已过期合同应库内 active、派生 expired');
  }

  // 场景 2：起草新合同（¥1,280,000 ≥100万 → 将触发 4 步审批链）
  const created = await call(
    'POST',
    '/api/contracts',
    {
      title: '智能仓储改造工程总包合同',
      counterparty: '无锡瀚云自动化设备有限公司',
      amount: '1280000.00',
      signDate: day(0),
      effectiveDate: day(15),
      expireDate: day(380),
      owner: '供应链部-赵一鸣',
    },
    201
  );
  const contractNo = created.contractNo as string;

  // 场景 3：提交审批——金额驱动生成 4 步链并物化任务
  const submitted = await call('POST', `/api/contracts/${contractNo}/submit`, null, 200);
  const chain = submitted.chain as Array<{ stepNo: number; role: string }>;
  if (chain.length !== 4 || chain[3]!.role !== '总经理') {
    failures++;
    console.error('✖ ¥1,280,000 应生成 4 步链且最后一步为总经理');
  }

  // 场景 4：查看审批链
  const approvals = (await call('GET', `/api/contracts/${contractNo}/approvals`, null, 200)) as unknown as {
    tasks: Array<{ id: number; stepNo: number; assignee: string; status: string }>;
  };
  const tasks = approvals.tasks;
  if (tasks.length !== 4 || !tasks.every((t) => t.status === 'pending')) {
    failures++;
    console.error('✖ 新链应有 4 条 pending 任务');
  }

  // 场景 5：越级决策被顺序状态机拒绝（附当前待决策步）
  await call(
    'POST',
    `/api/approvals/${tasks[2]!.id}/decision`,
    { decision: 'approve', operator: '李雪梅', opinion: '同意' },
    409
  );

  // 场景 6：按序决策 2 步（法务→部门负责人），响应给出 nextStep 指引
  await call(
    'POST',
    `/api/approvals/${tasks[0]!.id}/decision`,
    { decision: 'approve', operator: '周敏', opinion: '合同条款审查通过' },
    200
  );
  const step2 = await call(
    'POST',
    `/api/approvals/${tasks[1]!.id}/decision`,
    { decision: 'approve', operator: '王建国', opinion: '预算范围内，同意' },
    200
  );
  const nextStep = step2.nextStep as { assignee: string };
  if (step2.contractStatus !== 'approving' || nextStep.assignee !== '李雪梅') {
    failures++;
    console.error('✖ 通过 2 步后应仍 approving 且下一步为分管副总李雪梅');
  }

  // 场景 7：到期提醒——零调度器，一条 SQL 精确命中 30 天内到期的 active 件
  const reminders = (await call('GET', '/api/contracts/reminders?days=30', null, 200)) as unknown as Array<{
    contractNo: string;
    daysLeft: number;
  }>;
  const hitNos = reminders.map((r) => r.contractNo).sort();
  if (reminders.length !== 2 || hitNos[0] !== `HT-${YEAR}-0002` || hitNos[1] !== `HT-${YEAR}-0003`) {
    failures++;
    console.error('✖ 提醒应精确命中 0002（剩25天）与 0003（剩12天），不含已过期与 approving 件');
  }

  // 场景 8：终止一份 active 合同（0001 为已生效的办公用品框架合同，不在提醒窗口内）
  const terminated = await call(
    'POST',
    `/api/contracts/HT-${YEAR}-0001/terminate`,
    { operator: '法务-周敏', reason: '双方协商提前解除' },
    200
  );
  if (terminated.status !== 'terminated') {
    failures++;
    console.error('✖ 终止后状态应为 terminated');
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
