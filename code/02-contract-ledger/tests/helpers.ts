import { buildApp } from '../src/app.ts';

/** 测试夹具：内存库，每个用例独立建库（migrate 由 buildApp 完成） */
export async function createTestApp() {
  return await buildApp({ dbPath: ':memory:' });
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/** 相对今天偏移 n 天的 YYYY-MM-DD（UTC，与 SQL date('now') 同基准） */
export function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** 合法起草请求体（金额 ¥86,400.00 → 2 步审批链） */
export function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: '办公区保洁服务合同',
    counterparty: '上海洁邻环境服务有限公司',
    amount: '86400.00',
    signDate: daysFromNow(0),
    effectiveDate: daysFromNow(0),
    expireDate: daysFromNow(365),
    owner: '行政部-刘婷',
    ...overrides,
  };
}

export async function draft(app: TestApp, overrides: Record<string, unknown> = {}) {
  return await app.inject({ method: 'POST', url: '/api/contracts', payload: validDraft(overrides) });
}

export async function submit(app: TestApp, contractNo: string) {
  return await app.inject({ method: 'POST', url: `/api/contracts/${contractNo}/submit` });
}

export async function decide(
  app: TestApp,
  taskId: number,
  decision: 'approve' | 'reject',
  operator: string,
  opinion?: string
) {
  return await app.inject({
    method: 'POST',
    url: `/api/approvals/${taskId}/decision`,
    payload: { decision, operator, ...(opinion ? { opinion } : {}) },
  });
}

/** 当前审批链（tasks 按 round, stepNo 排序） */
export async function chainOf(app: TestApp, contractNo: string) {
  const res = await app.inject({ method: 'GET', url: `/api/contracts/${contractNo}/approvals` });
  return res.json() as {
    contractNo: string;
    contractStatus: string;
    currentRound: number;
    tasks: Array<{ id: number; round: number; stepNo: number; role: string; assignee: string; status: string }>;
  };
}

/** 走真实流程把一份合同做成 active：起草 → 提交 → 按序全部通过 */
export async function activateContract(app: TestApp, overrides: Record<string, unknown> = {}): Promise<string> {
  const created = (await draft(app, overrides)).json() as { contractNo: string };
  await submit(app, created.contractNo);
  // 逐步通过当前 pending 任务，直到链上没有 pending
  for (let guard = 0; guard < 10; guard++) {
    const chain = await chainOf(app, created.contractNo);
    const current = chain.tasks.find((t) => t.status === 'pending');
    if (!current) break;
    const res = await decide(app, current.id, 'approve', current.assignee);
    if (res.statusCode !== 200) throw new Error(`审批失败：${res.body}`);
  }
  return created.contractNo;
}
