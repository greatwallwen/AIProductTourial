import type { Db } from '../../shared/db.ts';
import { withTransaction } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import { createContractRepo } from './repo.ts';
import type { Contract, ContractStatus, ContractView, DraftInput, ReminderItem } from './types.ts';

/**
 * 合同状态机是一等公民数据结构：合法迁移只在这张表里。
 * 审批模块驱动 draft/rejected→approving→active/rejected，但状态机本身归合同模块所有。
 */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ['approving'],
  approving: ['active', 'rejected'],
  rejected: ['approving'],
  active: ['terminated'],
  terminated: [],
};

/**
 * ★金额换算的全系统唯一位置：API 边界用元字符串，库与领域逻辑一律用分（整数）。
 * 字符串整数运算，不经过浮点，"0.1 元"永远是 10 分。
 */
export function yuanToCents(amount: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!m) {
    throw new AppError('INVALID_AMOUNT', 400, `金额格式非法（应为元的数字字符串，如 "1280000.00"）：${amount}`);
  }
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

export function centsToYuan(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** UTC 今天（YYYY-MM-DD），与 SQL date('now') 同基准 */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 领域对象 → API 视图：换算金额、派生 expired（不落库） */
function toView(c: Contract): ContractView {
  return {
    contractNo: c.contractNo,
    title: c.title,
    counterparty: c.counterparty,
    amount: centsToYuan(c.amountCents),
    signDate: c.signDate,
    effectiveDate: c.effectiveDate,
    expireDate: c.expireDate,
    owner: c.owner,
    status: c.status,
    derivedStatus: c.status === 'active' && c.expireDate < today() ? 'expired' : c.status,
    createdAt: c.createdAt,
  };
}

export function createContractService(deps: { db: Db }) {
  const repo = createContractRepo(deps.db);

  function mustGetByNo(contractNo: string): Contract {
    const contract = repo.getByNo(contractNo);
    if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404, `合同不存在：${contractNo}`);
    return contract;
  }

  return {
    /** 起草：发号与建单同事务（withTransaction），并发不重号 */
    draft(input: DraftInput): { contractNo: string; status: 'draft'; amount: string } {
      const amountCents = yuanToCents(input.amount);
      if (input.expireDate < input.effectiveDate) {
        throw new AppError('INVALID_DATE_RANGE', 400, '到期日不得早于生效日');
      }
      return withTransaction(deps.db, () => {
        const contractNo = repo.nextContractNo(new Date().getFullYear());
        repo.insert({
          contractNo,
          title: input.title,
          counterparty: input.counterparty,
          amountCents,
          signDate: input.signDate,
          effectiveDate: input.effectiveDate,
          expireDate: input.expireDate,
          owner: input.owner,
          createdAt: new Date().toISOString(),
        });
        return { contractNo, status: 'draft' as const, amount: centsToYuan(amountCents) };
      });
    },

    /** 领域对象（含 id / amountCents）：供 approval 模块经组合根注入使用 */
    getByNo(contractNo: string): Contract {
      return mustGetByNo(contractNo);
    },

    /** API 视图（元字符串 + 派生状态）：供路由层使用 */
    detail(contractNo: string): ContractView {
      return toView(mustGetByNo(contractNo));
    },

    list(filter: { status?: ContractStatus; expireBefore?: string }): ContractView[] {
      return repo.list(filter).map(toView);
    },

    reminders(days: number): ReminderItem[] {
      return repo.reminders(days).map((c) => ({
        contractNo: c.contractNo,
        title: c.title,
        counterparty: c.counterparty,
        amount: centsToYuan(c.amountCents),
        expireDate: c.expireDate,
        owner: c.owner,
        daysLeft: c.daysLeft,
      }));
    },

    /** 终止合同：active → terminated（履约期内协商解除/到期终止）。非 active 状态 409。 */
    terminate(contractNo: string, _reason?: string): { contractNo: string; status: 'terminated' } {
      const contract = repo.getByNo(contractNo);
      if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404, `合同不存在：${contractNo}`);
      this.transition(contract.id, 'terminated');
      return { contractNo, status: 'terminated' };
    },

    /** 状态迁移：非法迁移 409。approval 模块只能通过这里改合同状态 */
    transition(id: number, to: ContractStatus): void {
      const contract = repo.getById(id);
      if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404, `合同不存在：id=${id}`);
      if (!CONTRACT_TRANSITIONS[contract.status].includes(to)) {
        throw new AppError('ILLEGAL_TRANSITION', 409, `合同状态 ${contract.status} 不允许迁移到 ${to}`, {
          currentStatus: contract.status,
          allowedTargets: [...CONTRACT_TRANSITIONS[contract.status]],
        });
      }
      repo.setStatus(id, to);
    },
  };
}

export type ContractService = ReturnType<typeof createContractService>;
