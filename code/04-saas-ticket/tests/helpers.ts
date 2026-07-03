import { buildApp } from '../src/app.ts';

/** 测试夹具：内存库 + 两个虚构租户（隔离类测试的最小舞台） */
export async function createTestApp() {
  return await buildApp({ dbPath: ':memory:' });
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export const TENANT_A = {
  companyName: '杭州明睿电子商务有限公司',
  tenantCode: 'MINGRUI',
  adminName: '沈毅',
  adminEmail: 'shenyi@mingrui.example.com',
  plan: 'pro',
};

export const TENANT_B = {
  companyName: '深圳市蓝湾软件有限公司',
  tenantCode: 'LANWAN',
  adminName: '陈璐',
  adminEmail: 'chenlu@lanwan.example.com',
};

/** 注册租户，返回响应（201 时 body 含仅此一次的明文 apiKey） */
export async function registerTenant(app: TestApp, payload: Record<string, unknown> = TENANT_A) {
  return await app.inject({ method: 'POST', url: '/api/tenants/register', payload });
}

/** 注册并直接取出明文 Key */
export async function registerAndGetKey(app: TestApp, payload: Record<string, unknown> = TENANT_A): Promise<string> {
  const res = await registerTenant(app, payload);
  if (res.statusCode !== 201) throw new Error(`注册失败：${res.body}`);
  return res.json().apiKey as string;
}

export async function createTicket(app: TestApp, apiKey: string, overrides: Record<string, unknown> = {}) {
  return await app.inject({
    method: 'POST',
    url: '/api/tickets',
    headers: { 'x-api-key': apiKey },
    payload: {
      title: '订单同步接口间歇性返回 502',
      priority: 'high',
      createdBy: 'shenyi@mingrui.example.com',
      ...overrides,
    },
  });
}

/** 推动工单执行一个动作 */
export async function act(
  app: TestApp,
  apiKey: string,
  ticketNo: string,
  action: string,
  actorEmail = 'shenyi@mingrui.example.com',
  note?: string
) {
  return await app.inject({
    method: 'POST',
    url: `/api/tickets/${ticketNo}/transition`,
    headers: { 'x-api-key': apiKey },
    payload: { action, actorEmail, ...(note ? { note } : {}) },
  });
}
