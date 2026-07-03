/** 状态集合：as const 联合类型（可枚举、可打印），与 001_init.sql 及状态机图逐字一致 */
export const STATUSES = [
  'submitted', // 已提交
  'accepted', // 已受理
  'supplementing', // 补正中
  'in_review', // 审批中
  'approved', // 已批准
  'denied', // 不予通过（终态）
  'not_accepted', // 不予受理（终态）
  'concluded', // 已办结（终态）
] as const;
export type Status = (typeof STATUSES)[number];

export const ACTIONS = [
  'accept',
  'reject_accept',
  'request_supplement',
  'resubmit',
  'start_review',
  'approve',
  'deny',
  'conclude',
] as const;
export type Action = (typeof ACTIONS)[number];

export interface SubmissionInput {
  itemCode: string;
  applicantName: string;
  /** 脱敏后的证件号，如 91310104MA1FL***XX */
  applicantIdNo: string;
  applicantPhone: string;
  materials: Array<{ materialName: string; fileRef: string }>;
}

export interface ApplicationSummary {
  applyNo: string;
  itemName: string;
  applicantName: string;
  status: Status;
  submittedAt: string;
  acceptedAt: string | null;
  promiseDays: number;
  /** 超出承诺时限的自然日数（演示用自然日近似工作日，简化说明见教程 2.3 节） */
  overdueDays: number | null;
}
