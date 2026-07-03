/** 审批任务状态集合：as const 联合类型，与 001_init.sql 的 CHECK 约束逐字一致 */
export const TASK_STATUSES = [
  'pending', // 待决策
  'approved', // 已通过
  'rejected', // 已驳回
  'skipped', // 因前序驳回被跳过
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DECISIONS = ['approve', 'reject'] as const;
export type Decision = (typeof DECISIONS)[number];

/** 审批链中的一步（提交时按金额物化到 approval_tasks） */
export interface ChainStep {
  stepNo: number;
  role: string;
  assignee: string;
}

export interface ApprovalTask {
  id: number;
  contractId: number;
  round: number;
  stepNo: number;
  role: string;
  assignee: string;
  status: TaskStatus;
  opinion: string | null;
  decidedAt: string | null;
}

/**
 * ★仓储端口（本工程的招牌决策）：service 只依赖这个接口。
 * SQLite 实现在 repo.ts；测试注入内存 Fake 即可单测全部审批业务逻辑，零 SQL。
 */
export interface ApprovalRepo {
  /** 该合同已存在的最大轮次，无任务时返回 0 */
  maxRound(contractId: number): number;
  insertTask(input: { contractId: number; round: number; stepNo: number; role: string; assignee: string }): number;
  getTask(taskId: number): ApprovalTask | undefined;
  /** 当前轮次中 step_no 最小的 pending 任务——顺序审批状态机的"当前步" */
  firstPending(contractId: number, round: number): ApprovalTask | undefined;
  decide(taskId: number, status: 'approved' | 'rejected', opinion: string | null, decidedAt: string): number;
  /** 驳回后：本轮剩余 pending 全部置为 skipped */
  skipPending(contractId: number, round: number): void;
  listByContract(contractId: number): ApprovalTask[];
}

/**
 * 合同侧端口：approval 模块只需要合同模块的这两个能力。
 * 组合根注入 ContractService（结构兼容），测试注入 Fake。
 */
export interface ContractGateway {
  /** 按编号取合同（不存在时抛 404 业务错误） */
  getByNo(contractNo: string): { id: number; contractNo: string; amountCents: number; status: string };
  /** 合同状态迁移（非法迁移抛 409 业务错误），状态机归合同模块所有 */
  transition(id: number, to: 'approving' | 'active' | 'rejected'): void;
}
