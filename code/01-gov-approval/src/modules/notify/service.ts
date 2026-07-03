import type { Db } from '../../shared/db.ts';
import { createNotifyRepo } from './repo.ts';
import { BACKOFF_MS, type OutboundMessage, type Sender } from './types.ts';

/** 默认发送器：真实部署下调用政务短信网关。示例工程内始终成功（无外部依赖）。 */
const noopSender: Sender = () => {};

export function createNotifyService(deps: { db: Db; sender?: Sender }) {
  const repo = createNotifyRepo(deps.db);
  const send = deps.sender ?? noopSender;

  return {
    /** 入队：与业务动作同一事务调用（办结时写这一行，不直接发短信） */
    enqueue(input: { applicationId: number; channel: string; recipient: string; payload: string }): number {
      const now = new Date().toISOString();
      return repo.enqueue({ ...input, nextRetryAt: now, createdAt: now });
    },

    /**
     * 投递到期消息：成功置 sent；失败按退避重试，超出退避序列即置 dead。
     * 生产由 server 的 setInterval 每分钟调用；测试直接调用并注入可控 sender。
     */
    async dispatchDue(nowMs: number = Date.now()): Promise<{ sent: number; retried: number; dead: number }> {
      const now = new Date(nowMs).toISOString();
      const due = repo.listDue(now);
      const result = { sent: 0, retried: 0, dead: 0 };
      for (const msg of due) {
        try {
          await send(msg);
          repo.markSent(msg.id, new Date(nowMs).toISOString());
          result.sent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const backoff = BACKOFF_MS[msg.retryCount];
          if (backoff === undefined) {
            repo.markDead(msg.id, message); // 退避序列用尽 → 转人工
            result.dead++;
          } else {
            repo.markRetry(msg.id, new Date(nowMs + backoff).toISOString(), message);
            result.retried++;
          }
        }
      }
      return result;
    },

    listByApplication(applicationId: number): OutboundMessage[] {
      return repo.listByApplication(applicationId);
    },
  };
}

export type NotifyService = ReturnType<typeof createNotifyService>;
