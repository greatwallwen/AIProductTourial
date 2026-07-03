import type { Db } from '../../shared/db.ts';
import type { OutboundMessage, OutboundStatus } from './types.ts';

interface Row {
  id: number;
  application_id: number;
  channel: string;
  recipient: string;
  payload: string;
  status: string;
  retry_count: number;
  next_retry_at: string;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

function toMsg(r: Row): OutboundMessage {
  return {
    id: r.id,
    applicationId: r.application_id,
    channel: r.channel,
    recipient: r.recipient,
    payload: r.payload,
    status: r.status as OutboundStatus,
    retryCount: r.retry_count,
    nextRetryAt: r.next_retry_at,
    lastError: r.last_error,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  };
}

export function createNotifyRepo(db: Db) {
  return {
    enqueue(input: {
      applicationId: number;
      channel: string;
      recipient: string;
      payload: string;
      nextRetryAt: string;
      createdAt: string;
    }): number {
      const r = db
        .prepare(
          `INSERT INTO outbound_messages (application_id, channel, recipient, payload, next_retry_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(input.applicationId, input.channel, input.recipient, input.payload, input.nextRetryAt, input.createdAt);
      return Number(r.lastInsertRowid);
    },

    /** 到点的待投递消息（status=pending 且 next_retry_at <= now），按到期时间先后 */
    listDue(now: string): OutboundMessage[] {
      const rows = db
        .prepare(
          `SELECT * FROM outbound_messages
           WHERE status = 'pending' AND next_retry_at <= ?
           ORDER BY next_retry_at`
        )
        .all(now) as unknown as Row[];
      return rows.map(toMsg);
    },

    markSent(id: number, sentAt: string): void {
      db.prepare("UPDATE outbound_messages SET status = 'sent', sent_at = ? WHERE id = ?").run(sentAt, id);
    },

    /** 失败重试：推进 retry_count 与 next_retry_at；status 保持 pending */
    markRetry(id: number, nextRetryAt: string, error: string): void {
      db.prepare(
        'UPDATE outbound_messages SET retry_count = retry_count + 1, next_retry_at = ?, last_error = ? WHERE id = ?'
      ).run(nextRetryAt, error, id);
    },

    markDead(id: number, error: string): void {
      db.prepare(
        "UPDATE outbound_messages SET status = 'dead', retry_count = retry_count + 1, last_error = ? WHERE id = ?"
      ).run(error, id);
    },

    listByApplication(applicationId: number): OutboundMessage[] {
      const rows = db
        .prepare('SELECT * FROM outbound_messages WHERE application_id = ? ORDER BY id')
        .all(applicationId) as unknown as Row[];
      return rows.map(toMsg);
    },
  };
}

export type NotifyRepo = ReturnType<typeof createNotifyRepo>;
