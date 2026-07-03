/** 合同状态集合：as const 联合类型，与 001_init.sql 的 CHECK 约束逐字一致 */
export const CONTRACT_STATUSES = [
  'draft', // 起草
  'approving', // 审批中
  'rejected', // 已驳回（可修改后重新提交）
  'active', // 生效中
  'terminated', // 已终止（终态）
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * 派生状态：expired 不落库——生效中合同到期与否由 expire_date 在查询时判定。
 * 落库会引入"谁来改状态"的调度器问题；派生则永远与当前时刻一致。
 */
export type DerivedStatus = ContractStatus | 'expired';

/** 领域对象：金额一律以分（整数）参与计算与存储，元字符串只出现在 API 边界 */
export interface Contract {
  id: number;
  contractNo: string;
  title: string;
  counterparty: string;
  amountCents: number;
  signDate: string; // YYYY-MM-DD
  effectiveDate: string;
  expireDate: string;
  owner: string;
  status: ContractStatus;
  createdAt: string;
}

/** API 视图：amount 为元字符串（如 "1280000.00"），换算在 service 边界完成 */
export interface ContractView {
  contractNo: string;
  title: string;
  counterparty: string;
  amount: string;
  signDate: string;
  effectiveDate: string;
  expireDate: string;
  owner: string;
  status: ContractStatus;
  derivedStatus: DerivedStatus;
  createdAt: string;
}

export interface DraftInput {
  title: string;
  counterparty: string;
  /** 元字符串，最多两位小数，如 "86400.00" */
  amount: string;
  signDate: string;
  effectiveDate: string;
  expireDate: string;
  owner: string;
}

/** 到期提醒项：daysLeft 为距到期的自然日数（SQL 派生） */
export interface ReminderItem {
  contractNo: string;
  title: string;
  counterparty: string;
  amount: string;
  expireDate: string;
  owner: string;
  daysLeft: number;
}
