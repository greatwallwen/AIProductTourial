import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, daysFromNow, draft, activateContract, type TestApp } from './helpers.ts';

describe('合同起草与台账', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  it('起草：201 生成 HT-{年}-{4位序号} 编号，金额元字符串精确回读', async () => {
    const res = await draft(app, { amount: '1280000.00' });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.match(body.contractNo, /^HT-\d{4}-0001$/);
    assert.equal(body.status, 'draft');
    assert.equal(body.amount, '1280000.00');

    const detail = (await app.inject({ method: 'GET', url: `/api/contracts/${body.contractNo}` })).json();
    assert.equal(detail.amount, '1280000.00');
    assert.equal(detail.derivedStatus, 'draft');
    // 分存储：库里是整数分，换算只发生在 service 边界
    const row = app.db
      .prepare('SELECT amount_cents FROM contracts WHERE contract_no = ?')
      .get(body.contractNo) as { amount_cents: number };
    assert.equal(row.amount_cents, 128_000_000);
  });

  it('金额格式非法（千分位/三位小数）：400 被 JSON Schema 拦截', async () => {
    for (const amount of ['86,400.00', '86400.999', '-1']) {
      const res = await draft(app, { amount });
      assert.equal(res.statusCode, 400, `金额 ${amount} 应被拒绝`);
      assert.equal(res.json().error.code, 'VALIDATION_FAILED');
    }
  });

  it('并发起草 3 份：发号器同事务递增，编号连续不重号', async () => {
    const results = await Promise.all([draft(app), draft(app), draft(app)]);
    const nos = results.map((r) => (r.json() as { contractNo: string }).contractNo);
    assert.equal(new Set(nos).size, 3, '编号不得重复');
    const seqs = nos.map((no) => Number(no.slice(-4))).sort((a, b) => a - b);
    assert.deepEqual(seqs, [1, 2, 3], '编号应连续');
  });

  it('台账：active 且已过 expire_date 的合同派生 expired，不落库', async () => {
    const expiredNo = await activateContract(app, { title: '已到期合同' });
    await activateContract(app, { title: '未到期合同' });
    // 回拨到期日到 5 天前（active 状态由真实审批流程产生，只改日期）
    app.db
      .prepare('UPDATE contracts SET expire_date = ? WHERE contract_no = ?')
      .run(daysFromNow(-5), expiredNo);

    const list = (await app.inject({ method: 'GET', url: '/api/contracts' })).json() as Array<{
      contractNo: string;
      status: string;
      derivedStatus: string;
    }>;
    const expired = list.find((c) => c.contractNo === expiredNo)!;
    assert.equal(expired.status, 'active', '库内状态仍是 active');
    assert.equal(expired.derivedStatus, 'expired', '查询时派生 expired');
    assert.ok(list.filter((c) => c.derivedStatus === 'active').length === 1);
  });

  it('台账筛选：status 与 expireBefore', async () => {
    await activateContract(app, { expireDate: daysFromNow(20) });
    await activateContract(app, { expireDate: daysFromNow(200) });
    await draft(app); // draft 一份

    const active = (await app.inject({ method: 'GET', url: '/api/contracts?status=active' })).json();
    assert.equal(active.length, 2);
    const soon = (
      await app.inject({ method: 'GET', url: `/api/contracts?status=active&expireBefore=${daysFromNow(30)}` })
    ).json();
    assert.equal(soon.length, 1);
  });

  it('到期提醒：只命中 [今天, 今天+days] 内到期的 active 件，不含已过期与 approving 件', async () => {
    const hitNo = await activateContract(app, { title: '30天内到期', expireDate: daysFromNow(25) });
    await activateContract(app, { title: '很久后到期', expireDate: daysFromNow(45) });
    const pastNo = await activateContract(app, { title: '已过期' });
    app.db.prepare('UPDATE contracts SET expire_date = ? WHERE contract_no = ?').run(daysFromNow(-3), pastNo);
    // approving 件：即将到期但尚未生效，不该提醒
    const approving = (await draft(app, { title: '审批中', expireDate: daysFromNow(10) })).json();
    await app.inject({ method: 'POST', url: `/api/contracts/${approving.contractNo}/submit` });

    const res = await app.inject({ method: 'GET', url: '/api/contracts/reminders?days=30' });
    assert.equal(res.statusCode, 200);
    const items = res.json() as Array<{ contractNo: string; daysLeft: number }>;
    assert.equal(items.length, 1, `应精确命中 1 件：${JSON.stringify(items)}`);
    assert.equal(items[0]!.contractNo, hitNo);
    assert.equal(items[0]!.daysLeft, 25);

    // 放宽窗口到 60 天则命中 2 件
    const wide = (await app.inject({ method: 'GET', url: '/api/contracts/reminders?days=60' })).json();
    assert.equal(wide.length, 2);
  });

  it('查询不存在的合同：404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/contracts/HT-2026-9999' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'CONTRACT_NOT_FOUND');
  });

  it('终止：active 合同可 terminate→terminated；draft 终止 409', async () => {
    const activeNo = await activateContract(app);
    const res = await app.inject({
      method: 'POST',
      url: `/api/contracts/${activeNo}/terminate`,
      payload: { operator: '法务-周敏', reason: '双方协商解除' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'terminated');
    const detail = (await app.inject({ method: 'GET', url: `/api/contracts/${activeNo}` })).json();
    assert.equal(detail.status, 'terminated');

    const draftNo = (await draft(app)).json().contractNo as string;
    const bad = await app.inject({
      method: 'POST',
      url: `/api/contracts/${draftNo}/terminate`,
      payload: { operator: 'x' },
    });
    assert.equal(bad.statusCode, 409);
    assert.equal(bad.json().error.code, 'ILLEGAL_TRANSITION');
  });
});
