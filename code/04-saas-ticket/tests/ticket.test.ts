import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTestApp,
  registerAndGetKey,
  createTicket,
  act,
  TENANT_A,
  TENANT_B,
  type TestApp,
} from './helpers.ts';

describe('工单流转与租户隔离', () => {
  let app: TestApp;
  let keyA: string;
  let keyB: string;
  beforeEach(async () => {
    app = await createTestApp();
    keyA = await registerAndGetKey(app, TENANT_A);
    keyB = await registerAndGetKey(app, TENANT_B);
  });
  afterEach(() => app.close());

  it('每租户独立发号：两租户各自从 0001 起互不干扰', async () => {
    const a1 = (await createTicket(app, keyA)).json();
    const b1 = (await createTicket(app, keyB, { title: '数据导出任务卡在 99%', priority: 'medium' })).json();
    const b2 = (await createTicket(app, keyB, { title: '登录页验证码不显示', priority: 'low' })).json();
    const a2 = (await createTicket(app, keyA, { title: '发票抬头信息变更申请', priority: 'low' })).json();
    assert.equal(a1.ticketNo, 'MINGRUI-0001');
    assert.equal(a2.ticketNo, 'MINGRUI-0002');
    assert.equal(b1.ticketNo, 'LANWAN-0001');
    assert.equal(b2.ticketNo, 'LANWAN-0002');
  });

  it('跨租户访问：A 的 Key 查/操作 B 的工单一律 404，不泄露资源存在性', async () => {
    const { ticketNo } = (await createTicket(app, keyB)).json();

    const read = await app.inject({
      method: 'GET',
      url: `/api/tickets/${ticketNo}`,
      headers: { 'x-api-key': keyA },
    });
    assert.equal(read.statusCode, 404, '不是 403：403 会暴露「资源存在但无权」');
    assert.equal(read.json().error.code, 'TICKET_NOT_FOUND');

    const write = await act(app, keyA, ticketNo, 'start');
    assert.equal(write.statusCode, 404, '流转同样 404，读写口径一致');

    // B 自己访问自己的工单当然是 200
    const own = await app.inject({
      method: 'GET',
      url: `/api/tickets/${ticketNo}`,
      headers: { 'x-api-key': keyB },
    });
    assert.equal(own.statusCode, 200);
  });

  it('列表绝不含他租户数据（含筛选条件下）', async () => {
    await createTicket(app, keyA);
    await createTicket(app, keyA, { title: '发票抬头信息变更申请', priority: 'low' });
    await createTicket(app, keyB, { title: '数据导出任务卡在 99%', priority: 'high' });

    const listA = (await app.inject({ method: 'GET', url: '/api/tickets', headers: { 'x-api-key': keyA } })).json();
    assert.equal(listA.length, 2);
    assert.ok(listA.every((t: { ticketNo: string }) => t.ticketNo.startsWith('MINGRUI-')));

    // 两租户各有一张 high 单：按优先级筛选也只见自己的
    const highA = (
      await app.inject({ method: 'GET', url: '/api/tickets?priority=high', headers: { 'x-api-key': keyA } })
    ).json();
    assert.equal(highA.length, 1);
    assert.equal(highA[0].ticketNo, 'MINGRUI-0001');
  });

  it('状态机通路走通（含 reopen 回路）；open 直接 close 返回 409 并告知允许的动作', async () => {
    const { ticketNo } = (await createTicket(app, keyA)).json();
    for (const [action, expected] of [
      ['start', 'in_progress'],
      ['resolve', 'resolved'],
      ['reopen', 'in_progress'],
      ['resolve', 'resolved'],
      ['close', 'closed'],
    ] as const) {
      const res = await act(app, keyA, ticketNo, action);
      assert.equal(res.statusCode, 200, `${action} 应成功：${res.body}`);
      assert.equal(res.json().status, expected);
    }

    const fresh = (await createTicket(app, keyA, { title: '发票抬头信息变更申请', priority: 'low' })).json();
    const illegal = await act(app, keyA, fresh.ticketNo, 'close');
    assert.equal(illegal.statusCode, 409);
    const body = illegal.json();
    assert.equal(body.error.code, 'ILLEGAL_TRANSITION');
    assert.deepEqual(body.error.details.allowedActions, ['start']);
  });

  it('事件流完整：created 起步，每次流转一条，备注留存', async () => {
    const { ticketNo } = (await createTicket(app, keyA)).json();
    await act(app, keyA, ticketNo, 'start', 'shenyi@mingrui.example.com', '已复现，排查中');
    await act(app, keyA, ticketNo, 'resolve', 'shenyi@mingrui.example.com', '网关连接池参数已调整');

    const detail = (
      await app.inject({ method: 'GET', url: `/api/tickets/${ticketNo}`, headers: { 'x-api-key': keyA } })
    ).json();
    assert.equal(detail.status, 'resolved');
    assert.equal(detail.assignee, 'shenyi@mingrui.example.com', 'start 应自动认领');
    assert.deepEqual(
      detail.events.map((e: { action: string; fromStatus: string; toStatus: string }) => [
        e.action,
        e.fromStatus,
        e.toStatus,
      ]),
      [
        ['created', '-', 'open'],
        ['start', 'open', 'in_progress'],
        ['resolve', 'in_progress', 'resolved'],
      ]
    );
    assert.equal(detail.events[2].note, '网关连接池参数已调整');
  });
});
