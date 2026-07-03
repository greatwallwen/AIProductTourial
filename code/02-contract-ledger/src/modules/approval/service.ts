import { AppError } from '../../shared/errors.ts';
import type { ApprovalRepo, ChainStep, ContractGateway, Decision } from './types.ts';

/**
 * 审批链规则是一等公民数据结构：金额阈值（分）命中即追加一步，从上到下即链的顺序。
 * 改审批链 = 改这张表，不改任何流程代码。
 */
export const CHAIN_LEVELS = [
  { minAmountCents: 0, role: '法务', assignee: '周敏' },
  { minAmountCents: 0, role: '部门负责人', assignee: '王建国' },
  { minAmountCents: 10_000_000, role: '分管副总', assignee: '李雪梅' }, // ≥ 10 万元
  { minAmountCents: 100_000_000, role: '总经理', assignee: '陈志远' }, // ≥ 100 万元
] as const;

/** 纯函数：金额（分）→ 审批链。无 IO、无状态，天然可测 */
export function buildApprovalChain(amountCents: number): ChainStep[] {
  return CHAIN_LEVELS.filter((level) => amountCents >= level.minAmountCents).map((level, i) => ({
    stepNo: i + 1,
    role: level.role,
    assignee: level.assignee,
  }));
}

export interface DecisionResult {
  taskId: number;
  stepNo: number;
  decision: Decision;
  contractStatus: 'approving' | 'active' | 'rejected';
  nextStep: ChainStep & { taskId: number } | null;
}

/**
 * ★仓储接口隔离（本工程招牌决策）：service 只依赖 ApprovalRepo / ContractGateway 端口与 tx 回调，
 * 不 import node:sqlite——全部审批逻辑可用内存 Fake 单测（见 tests/approval-chain.test.ts）。
 * SQLite 的连线只发生在组合根 app.ts。
 */
export function createApprovalService(deps: {
  repo: ApprovalRepo;
  contracts: ContractGateway;
  tx: <T>(fn: () => T) => T;
}) {
  return {
    /** 提交审批：按金额物化审批链到 approval_tasks，合同进入 approving。驳回件重提 round+1 */
    submit(contractNo: string) {
      const contract = deps.contracts.getByNo(contractNo);
      if (contract.status !== 'draft' && contract.status !== 'rejected') {
        throw new AppError('CONTRACT_NOT_SUBMITTABLE', 409, `当前状态 ${contract.status} 不允许提交审批`, {
          currentStatus: contract.status,
        });
      }
      const round = deps.repo.maxRound(contract.id) + 1;
      const chain = buildApprovalChain(contract.amountCents);
      deps.tx(() => {
        for (const step of chain) {
          deps.repo.insertTask({ contractId: contract.id, round, ...step });
        }
        deps.contracts.transition(contract.id, 'approving');
      });
      return { contractNo, round, status: 'approving' as const, chain };
    },

    /**
     * 顺序审批状态机：只有当前轮次中 step_no 最小的 pending 任务可决策。
     * approve 推进到下一步（最后一步 → 合同 active）；reject → 合同 rejected，剩余任务 skipped。
     */
    decide(taskId: number, input: { decision: Decision; operator: string; opinion?: string }): DecisionResult {
      const task = deps.repo.getTask(taskId);
      if (!task) throw new AppError('TASK_NOT_FOUND', 404, `审批任务不存在：${taskId}`);
      const current = deps.repo.firstPending(task.contractId, task.round);
      if (!current || current.id !== task.id) {
        throw new AppError(
          'STEP_OUT_OF_ORDER',
          409,
          current
            ? `只能决策当前步：第 ${current.stepNo} 步（${current.role} ${current.assignee}）`
            : '该轮审批已结束，任务不可再决策',
          {
            taskStatus: task.status,
            currentStep: current
              ? { taskId: current.id, stepNo: current.stepNo, role: current.role, assignee: current.assignee }
              : null,
          }
        );
      }

      const decidedAt = new Date().toISOString();
      if (input.decision === 'approve') {
        return deps.tx(() => {
          if (deps.repo.decide(task.id, 'approved', input.opinion ?? null, decidedAt) === 0) {
            throw new AppError('CONCURRENT_MODIFICATION', 409, `任务 ${task.id} 已被并发决策，请刷新重试`);
          }
          const next = deps.repo.firstPending(task.contractId, task.round);
          if (!next) {
            deps.contracts.transition(task.contractId, 'active'); // 最后一步通过 → 合同生效
            return { taskId: task.id, stepNo: task.stepNo, decision: input.decision, contractStatus: 'active' as const, nextStep: null };
          }
          return {
            taskId: task.id,
            stepNo: task.stepNo,
            decision: input.decision,
            contractStatus: 'approving' as const,
            nextStep: { taskId: next.id, stepNo: next.stepNo, role: next.role, assignee: next.assignee },
          };
        });
      }
      return deps.tx(() => {
        if (deps.repo.decide(task.id, 'rejected', input.opinion ?? null, decidedAt) === 0) {
          throw new AppError('CONCURRENT_MODIFICATION', 409, `任务 ${task.id} 已被并发决策，请刷新重试`);
        }
        deps.repo.skipPending(task.contractId, task.round); // 后续步骤全部跳过
        deps.contracts.transition(task.contractId, 'rejected');
        return { taskId: task.id, stepNo: task.stepNo, decision: input.decision, contractStatus: 'rejected' as const, nextStep: null };
      });
    },

    /** 审批链全貌：含历史轮次（驳回重提后旧链保留，审计可追溯） */
    listChain(contractNo: string) {
      const contract = deps.contracts.getByNo(contractNo);
      const tasks = deps.repo.listByContract(contract.id);
      return {
        contractNo,
        contractStatus: contract.status,
        currentRound: tasks.reduce((max, t) => Math.max(max, t.round), 0),
        tasks,
      };
    },
  };
}

export type ApprovalService = ReturnType<typeof createApprovalService>;
