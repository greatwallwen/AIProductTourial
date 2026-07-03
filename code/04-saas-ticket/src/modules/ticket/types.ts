/** 状态集合：as const 联合类型（可枚举、可打印），与 001_init.sql 及状态机图逐字一致 */
export const STATUSES = [
  'open', // 待处理
  'in_progress', // 处理中
  'resolved', // 已解决
  'closed', // 已关闭（终态）
] as const;
export type Status = (typeof STATUSES)[number];

export const ACTIONS = ['start', 'resolve', 'reopen', 'close'] as const;
export type Action = (typeof ACTIONS)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * 已鉴权的租户上下文：鉴权钩子写入 request，ticket 模块所有入口的第一参数。
 * 结构与 tenant 模块的 TenantIdentity 一致（结构化类型对接），模块间零 import。
 */
export interface TenantContext {
  tenantId: number;
  tenantCode: string;
}

export interface CreateTicketInput {
  title: string;
  priority: Priority;
  /** 创建人邮箱（租户内用户标识） */
  createdBy: string;
  assignee?: string;
}

export interface TicketSummary {
  ticketNo: string;
  title: string;
  priority: Priority;
  status: Status;
  assignee: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
