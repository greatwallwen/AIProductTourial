/** 出站消息状态：as const 联合类型，与 002_notify.sql 的 CHECK 约束一致 */
export const OUTBOUND_STATUSES = ['pending', 'sent', 'dead'] as const;
export type OutboundStatus = (typeof OUTBOUND_STATUSES)[number];

export interface OutboundMessage {
  id: number;
  applicationId: number;
  channel: string;
  recipient: string;
  payload: string;
  status: OutboundStatus;
  retryCount: number;
  nextRetryAt: string;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

/** 退避序列（毫秒）：1min → 5min → 30min → 2h；累计超出即置 dead */
export const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000] as const;

/** 发送器：注入以便测试替换（默认走真实网关，测试注入 mock）。抛错即视为发送失败。 */
export type Sender = (msg: OutboundMessage) => void | Promise<void>;
