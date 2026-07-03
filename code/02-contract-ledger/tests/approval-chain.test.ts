import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApprovalChain,
  createApprovalService,
  type ApprovalRepo,
  type ApprovalTask,
  type ContractGateway,
} from '../src/modules/approval/index.ts';

/**
 * ★本工程招牌决策的实证：审批业务逻辑只依赖 ApprovalRepo / ContractGateway 两个端口。
 * 本文件不 import node:sqlite、不 import buildApp——用内存 Fake 单测全部链生成与决策逻辑，零 SQL。
 */

function createFakeRepo(): ApprovalRepo & { tasks: ApprovalTask[] } {
  const tasks: ApprovalTask[] = [];
  let nextId = 1;
  return {
    tasks,
    maxRound: (contractId) =>
      tasks.filter((t) => t.contractId === contractId).reduce((m, t) => Math.max(m, t.round), 0),
    insertTask(input) {
      const task: ApprovalTask = { id: nextId++, status: 'pending', opinion: null, decidedAt: null, ...input };
      tasks.push(task);
      return task.id;
    },
    getTask: (taskId) => tasks.find((t) => t.id === taskId),
    firstPending: (contractId, round) =>
      tasks
        .filter((t) => t.contractId === contractId && t.round === round && t.status === 'pending')
        .sort((a, b) => a.stepNo - b.stepNo)[0],
    decide(taskId, status, opinion, decidedAt) {
      const task = tasks.find((t) => t.id === taskId)!;
      if (task.status !== 'pending') return 0; // from 守卫：非 pending 命中 0 行
      task.status = status;
      task.opinion = opinion;
      task.decidedAt = decidedAt;
      return 1;
    },
    skipPending(contractId, round) {
      for (const t of tasks) {
        if (t.contractId === contractId && t.round === round && t.status === 'pending') t.status = 'skipped';
      }
    },
    listByContract: (contractId) => tasks.filter((t) => t.contractId === contractId),
  };
}

function createFakeContracts(amountCents: number): ContractGateway & { status: string } {
  return {
    status: 'draft',
    getByNo(contractNo) {
      return { id: 1, contractNo, amountCents, status: this.status };
    },
    transition(_id, to) {
      this.status = to;
    },
  };
}

/** 组装一个完全在内存中的 approval service */
function setup(amountCents: number) {
  const repo = createFakeRepo();
  const contracts = createFakeContracts(amountCents);
  const service = createApprovalService({ repo, contracts, tx: (fn) => fn() });
  return { repo, contracts, service };
}

describe('审批链生成（Fake 仓储，零 SQL）', () => {
  it('¥86,400（<10万）→ 2 步：法务→部门负责人', () => {
    const { repo, contracts, service } = setup(8_640_000);
    const result = service.submit('HT-2026-9001');
    assert.equal(result.round, 1);
    assert.deepEqual(
      repo.tasks.map((t) => [t.stepNo, t.role, t.assignee]),
      [
        [1, '法务', '周敏'],
        [2, '部门负责人', '王建国'],
      ]
    );
    assert.equal(contracts.status, 'approving');
  });

  it('¥486,000（≥10万）→ 3 步：追加分管副总', () => {
    const { repo, service } = setup(48_600_000);
    service.submit('HT-2026-9002');
    assert.deepEqual(
      repo.tasks.map((t) => [t.stepNo, t.role, t.assignee]),
      [
        [1, '法务', '周敏'],
        [2, '部门负责人', '王建国'],
        [3, '分管副总', '李雪梅'],
      ]
    );
  });

  it('¥1,280,000（≥100万）→ 4 步：再追加总经理', () => {
    const { repo, service } = setup(128_000_000);
    service.submit('HT-2026-9003');
    assert.deepEqual(
      repo.tasks.map((t) => [t.stepNo, t.role, t.assignee]),
      [
        [1, '法务', '周敏'],
        [2, '部门负责人', '王建国'],
        [3, '分管副总', '李雪梅'],
        [4, '总经理', '陈志远'],
      ]
    );
  });

  it('阈值边界：10万整走 3 步，差 1 分走 2 步；100万整走 4 步', () => {
    assert.equal(buildApprovalChain(10_000_000).length, 3);
    assert.equal(buildApprovalChain(9_999_999).length, 2);
    assert.equal(buildApprovalChain(100_000_000).length, 4);
    assert.equal(buildApprovalChain(99_999_999).length, 3);
  });

  it('顺序决策全部通过 → 合同 active（决策状态机同样零 SQL 可测）', () => {
    const { repo, contracts, service } = setup(48_600_000);
    service.submit('HT-2026-9004');
    for (const task of [...repo.tasks]) {
      service.decide(task.id, { decision: 'approve', operator: task.assignee });
    }
    assert.ok(repo.tasks.every((t) => t.status === 'approved'));
    assert.equal(contracts.status, 'active');
  });

  it('中途驳回 → 合同 rejected，剩余任务 skipped', () => {
    const { repo, contracts, service } = setup(128_000_000);
    service.submit('HT-2026-9005');
    service.decide(repo.tasks[0]!.id, { decision: 'approve', operator: '周敏' });
    service.decide(repo.tasks[1]!.id, { decision: 'reject', operator: '王建国', opinion: '付款条款风险过高' });
    assert.deepEqual(
      repo.tasks.map((t) => t.status),
      ['approved', 'rejected', 'skipped', 'skipped']
    );
    assert.equal(contracts.status, 'rejected');
  });
});
