import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, validSubmission, act } from './helpers.ts';

describe('申报与审批状态机', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  async function submit(payload: object = validSubmission) {
    return await app.inject({ method: 'POST', url: '/api/applications', payload });
  }

  it('正常申报：生成合规编号并进入 submitted', async () => {
    const res = await submit();
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.match(body.applyNo, /^310104-\d{8}-0001$/);
    assert.equal(body.status, 'submitted');
  });

  it('缺必备材料：400 拒绝并列出缺项', async () => {
    const res = await submit({
      ...validSubmission,
      materials: validSubmission.materials.slice(0, 2),
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.error.code, 'MATERIALS_MISSING');
    assert.deepEqual(body.error.details.missing, ['食品安全管理制度', '从业人员健康证明']);
  });

  it('同日连续申报编号递增不重号', async () => {
    const a = (await submit()).json();
    const b = (await submit()).json();
    const c = (await submit()).json();
    const seqs = [a, b, c].map((x) => Number(x.applyNo.slice(-4)));
    assert.deepEqual(seqs, [1, 2, 3]);
  });

  it('合法链路走通：accept→start_review→approve→conclude，留痕 5 条', async () => {
    const { applyNo } = (await submit()).json();
    for (const [action, expected] of [
      ['accept', 'accepted'],
      ['start_review', 'in_review'],
      ['approve', 'approved'],
      ['conclude', 'concluded'],
    ] as const) {
      const res = await act(app, applyNo, action, '窗口-李芳');
      assert.equal(res.statusCode, 200, `${action} 应成功：${res.body}`);
      assert.equal(res.json().status, expected);
    }
    const detail = (await app.inject({ method: 'GET', url: `/api/applications/${applyNo}` })).json();
    assert.equal(detail.status, 'concluded');
    assert.ok(detail.licenceNo, '办结应签发证照号');
    assert.equal(detail.logs.length, 5, '提交+4次流转=5条留痕');
    assert.equal(detail.logs.at(-1).action, 'conclude');
  });

  it('补正循环：受理后可要求补正并重新提交', async () => {
    const { applyNo } = (await submit()).json();
    await act(app, applyNo, 'accept');
    const r1 = await act(app, applyNo, 'request_supplement', '窗口-李芳', '平面图不清晰');
    assert.equal(r1.json().status, 'supplementing');
    const r2 = await act(app, applyNo, 'resubmit', '申请人');
    assert.equal(r2.json().status, 'accepted');
  });

  it('非法迁移：submitted 直接 approve 返回 409 并告知允许的动作', async () => {
    const { applyNo } = (await submit()).json();
    const res = await act(app, applyNo, 'approve');
    assert.equal(res.statusCode, 409);
    const body = res.json();
    assert.equal(body.error.code, 'ILLEGAL_TRANSITION');
    assert.deepEqual(body.error.details.allowedActions.sort(), ['accept', 'reject_accept']);
  });

  it('终态封闭：不予受理后任何动作均 409', async () => {
    const { applyNo } = (await submit()).json();
    await act(app, applyNo, 'reject_accept', '窗口-李芳', '不属于本部门受理范围');
    for (const action of ['accept', 'approve', 'conclude']) {
      const res = await act(app, applyNo, action);
      assert.equal(res.statusCode, 409, `终态后 ${action} 应被拒绝`);
    }
  });

  it('超期查询：只命中超过承诺时限的在办件', async () => {
    const { applyNo: fresh } = (await submit()).json();
    await act(app, fresh, 'accept');
    const { applyNo: old } = (await submit()).json();
    await act(app, old, 'accept');
    // 将第二件的受理时间改到 15 天前（承诺时限 10 天 → 超期）
    const past = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();
    app.db.prepare('UPDATE applications SET accepted_at = ? WHERE apply_no = ?').run(past, old);

    const res = await app.inject({ method: 'GET', url: '/api/applications?overdue=true' });
    assert.equal(res.statusCode, 200);
    const list = res.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].applyNo, old);
    assert.ok(list[0].overdueDays >= 5);
  });

  it('条件更新守卫：expectedFrom 与库内状态不符时命中 0 行（不静默覆盖）', async () => {
    const { applyNo } = (await submit()).json();
    await act(app, applyNo, 'accept'); // 现为 accepted
    const row = app.db.prepare('SELECT id FROM applications WHERE apply_no = ?').get(applyNo) as { id: number };
    const { createApplicationRepo } = await import('../src/modules/application/repo.ts');
    const repo = createApplicationRepo(app.db);
    // 用错误的 expectedFrom（submitted，实为 accepted）更新 → 0 行
    assert.equal(repo.updateStatus(row.id, 'submitted', 'in_review'), 0, '错误的 from 不得命中');
    // 正确的 expectedFrom → 1 行
    assert.equal(repo.updateStatus(row.id, 'accepted', 'in_review'), 1, '正确的 from 应命中 1 行');
  });

  it('超期口径一致：过限不足一整日的件不进列表，进列表者 overdueDays≥1', async () => {
    // 承诺 10 工作日；受理时间回拨 10.5 天：过限半日，尚不足一个整日
    const { applyNo } = (await submit()).json();
    await act(app, applyNo, 'accept');
    const past = new Date(Date.now() - 10.5 * 24 * 3600 * 1000).toISOString();
    app.db.prepare('UPDATE applications SET accepted_at = ? WHERE apply_no = ?').run(past, applyNo);

    const list = (await app.inject({ method: 'GET', url: '/api/applications?overdue=true' })).json();
    // 过滤口径与 overdueDays 展示口径必须一致：不能出现"在列表里但 overdueDays=0"的自相矛盾
    for (const item of list) assert.ok(item.overdueDays >= 1, `进入超期列表者 overdueDays 必须≥1，实际 ${item.overdueDays}`);
    assert.equal(list.length, 0, '过限不足一整日不算超期');
  });
});
