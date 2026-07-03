import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, draft, submit, decide, chainOf, type TestApp } from './helpers.ts';

describe('提交审批与顺序决策状态机', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  async function draftNo(overrides: Record<string, unknown> = {}): Promise<string> {
    return ((await draft(app, overrides)).json() as { contractNo: string }).contractNo;
  }

  it('submit：按金额物化审批链，合同进入 approving', async () => {
    const no = await draftNo({ amount: '1280000.00' });
    const res = await submit(app, no);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.round, 1);
    assert.equal(body.status, 'approving');
    assert.deepEqual(
      body.chain.map((s: { role: string }) => s.role),
      ['法务', '部门负责人', '分管副总', '总经理']
    );
    const chain = await chainOf(app, no);
    assert.equal(chain.tasks.length, 4);
    assert.ok(chain.tasks.every((t) => t.status === 'pending'));
  });

  it('approving 状态重复 submit：409', async () => {
    const no = await draftNo();
    await submit(app, no);
    const res = await submit(app, no);
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error.code, 'CONTRACT_NOT_SUBMITTABLE');
  });

  it('越过当前步决策：409 并告知当前待决策步', async () => {
    const no = await draftNo({ amount: '486000.00' });
    await submit(app, no);
    const { tasks } = await chainOf(app, no);
    const res = await decide(app, tasks[2]!.id, 'approve', '李雪梅');
    assert.equal(res.statusCode, 409);
    const body = res.json();
    assert.equal(body.error.code, 'STEP_OUT_OF_ORDER');
    assert.equal(body.error.details.currentStep.stepNo, 1);
    assert.equal(body.error.details.currentStep.assignee, '周敏');
  });

  it('已决策任务再次决策：409', async () => {
    const no = await draftNo();
    await submit(app, no);
    const { tasks } = await chainOf(app, no);
    await decide(app, tasks[0]!.id, 'approve', '周敏');
    const res = await decide(app, tasks[0]!.id, 'approve', '周敏');
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error.code, 'STEP_OUT_OF_ORDER');
  });

  it('全链按序通过 → 合同 active，每步返回 nextStep 指引', async () => {
    const no = await draftNo({ amount: '486000.00' }); // 3 步链
    await submit(app, no);
    const { tasks } = await chainOf(app, no);

    const r1 = (await decide(app, tasks[0]!.id, 'approve', '周敏', '条款合规')).json();
    assert.equal(r1.contractStatus, 'approving');
    assert.equal(r1.nextStep.assignee, '王建国');
    const r2 = (await decide(app, tasks[1]!.id, 'approve', '王建国')).json();
    assert.equal(r2.nextStep.assignee, '李雪梅');
    const r3 = (await decide(app, tasks[2]!.id, 'approve', '李雪梅', '同意签署')).json();
    assert.equal(r3.contractStatus, 'active');
    assert.equal(r3.nextStep, null);

    const detail = (await app.inject({ method: 'GET', url: `/api/contracts/${no}` })).json();
    assert.equal(detail.status, 'active');
  });

  it('驳回 → 合同 rejected 剩余任务 skipped；重新 submit → round=2 新链', async () => {
    const no = await draftNo({ amount: '1280000.00' }); // 4 步链
    await submit(app, no);
    let { tasks } = await chainOf(app, no);
    await decide(app, tasks[0]!.id, 'approve', '周敏');
    const rejected = (await decide(app, tasks[1]!.id, 'reject', '王建国', '预算超出部门年度额度')).json();
    assert.equal(rejected.contractStatus, 'rejected');

    const after = await chainOf(app, no);
    assert.deepEqual(
      after.tasks.map((t) => t.status),
      ['approved', 'rejected', 'skipped', 'skipped']
    );

    // 修改后重新提交：round+1 生成全新 4 步链，历史链保留
    const resubmit = (await submit(app, no)).json();
    assert.equal(resubmit.round, 2);
    const round2 = await chainOf(app, no);
    assert.equal(round2.currentRound, 2);
    assert.equal(round2.tasks.length, 8, '第 1 轮 4 条历史 + 第 2 轮 4 条新任务');
    assert.ok(round2.tasks.filter((t) => t.round === 2).every((t) => t.status === 'pending'));

    // 被跳过的旧任务不可决策
    const skippedTask = after.tasks[2]!;
    const res = await decide(app, skippedTask.id, 'approve', '李雪梅');
    assert.equal(res.statusCode, 409);
  });

  it('decision 枚举校验与任务不存在：400 / 404', async () => {
    const no = await draftNo();
    await submit(app, no);
    const { tasks } = await chainOf(app, no);
    const bad = await app.inject({
      method: 'POST',
      url: `/api/approvals/${tasks[0]!.id}/decision`,
      payload: { decision: 'maybe', operator: '周敏' },
    });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.json().error.code, 'VALIDATION_FAILED');

    const missing = await decide(app, 99_999, 'approve', '周敏');
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, 'TASK_NOT_FOUND');
  });

  it('draft 状态的合同不可决策（无任务），terminated 等非法提交被拒', async () => {
    const no = await draftNo();
    const chain = await chainOf(app, no);
    assert.equal(chain.tasks.length, 0, '未提交时无审批任务');
    // 直接把合同置为 active 后 submit（active 不可再提交）
    app.db.prepare("UPDATE contracts SET status = 'active' WHERE contract_no = ?").run(no);
    const res = await submit(app, no);
    assert.equal(res.statusCode, 409);
  });
});
