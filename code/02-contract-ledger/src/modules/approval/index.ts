/** approval 模块唯一公共出口：其他模块与组合根只能从这里 import */
export {
  createApprovalService,
  type ApprovalService,
  type DecisionResult,
  buildApprovalChain,
  CHAIN_LEVELS,
} from './service.ts';
export { createApprovalRepo } from './repo.ts';
export { approvalRoutes } from './routes.ts';
export {
  TASK_STATUSES,
  DECISIONS,
  type TaskStatus,
  type Decision,
  type ChainStep,
  type ApprovalTask,
  type ApprovalRepo,
  type ContractGateway,
} from './types.ts';
