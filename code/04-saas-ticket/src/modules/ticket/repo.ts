import type { Db } from '../../shared/db.ts';
import type { Priority, Status, TicketSummary } from './types.ts';

interface TicketRow {
  id: number;
  tenant_id: number;
  ticket_no: string;
  title: string;
  priority: string;
  status: string;
  assignee: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function toSummary(r: TicketRow): TicketSummary {
  return {
    ticketNo: r.ticket_no,
    title: r.title,
    priority: r.priority as Priority,
    status: r.status as Status,
    assignee: r.assignee,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * 隔离双保险之二：repo 层强制租户隔离。
 * 本文件所有函数第一个参数必须是 tenantId，所有 SELECT/UPDATE 一律 WHERE tenant_id = ?。
 * 这条纪律由 tests/architecture.test.ts 规则 4 正则扫描源码守护。
 */
export function createTicketRepo(db: Db) {
  return {
    /** 发号：与建单同一事务内递增。行由注册开通事务写入（seq=0），不存在即开通不完整。 */
    nextTicketNo(tenantId: number, tenantCode: string): string {
      const row = db
        .prepare('UPDATE ticket_seq SET seq = seq + 1 WHERE tenant_id = ? RETURNING seq')
        .get(tenantId) as { seq: number } | undefined;
      if (!row) throw new Error(`发号器未初始化：tenant ${tenantId}（注册开通事务应已创建）`);
      return `${tenantCode}-${String(row.seq).padStart(4, '0')}`;
    },

    insertTicket(
      tenantId: number,
      input: {
        ticketNo: string;
        title: string;
        priority: Priority;
        assignee?: string;
        createdBy: string;
        createdAt: string;
      }
    ): number {
      const r = db
        .prepare(
          `INSERT INTO tickets
             (tenant_id, ticket_no, title, priority, status, assignee, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`
        )
        .run(
          tenantId,
          input.ticketNo,
          input.title,
          input.priority,
          input.assignee ?? null,
          input.createdBy,
          input.createdAt,
          input.createdAt
        );
      return Number(r.lastInsertRowid);
    },

    getByTicketNo(tenantId: number, ticketNo: string): TicketRow | undefined {
      return db
        .prepare('SELECT * FROM tickets WHERE tenant_id = ? AND ticket_no = ?')
        .get(tenantId, ticketNo) as unknown as TicketRow | undefined;
    },

    list(tenantId: number, filter: { status?: string; priority?: string }): TicketSummary[] {
      const conds: string[] = [];
      const params: Array<number | string> = [tenantId];
      if (filter.status) {
        conds.push('AND status = ?');
        params.push(filter.status);
      }
      if (filter.priority) {
        conds.push('AND priority = ?');
        params.push(filter.priority);
      }
      const rows = db
        .prepare(`SELECT * FROM tickets WHERE tenant_id = ? ${conds.join(' ')} ORDER BY id DESC`)
        .all(...params) as unknown as TicketRow[];
      return rows.map(toSummary);
    },

    /** 条件更新：WHERE 带 status = expectedFrom 守卫，返回受影响行数（TOCTOU 防护，见工单状态机说明）。 */
    updateStatus(
      tenantId: number,
      id: number,
      expectedFrom: Status,
      to: Status,
      patch: { updatedAt: string; assignee?: string }
    ): number {
      const r = db
        .prepare(
          `UPDATE tickets SET
             status = ?,
             updated_at = ?,
             assignee = COALESCE(?, assignee)
           WHERE tenant_id = ? AND id = ? AND status = ?`
        )
        .run(to, patch.updatedAt, patch.assignee ?? null, tenantId, id, expectedFrom);
      return r.changes as number;
    },

    /** 事件流：只增不改 */
    insertEvent(
      tenantId: number,
      input: {
        ticketId: number;
        action: string;
        fromStatus: string;
        toStatus: string;
        actor: string;
        note?: string;
        createdAt: string;
      }
    ): void {
      db.prepare(
        `INSERT INTO ticket_events (tenant_id, ticket_id, action, from_status, to_status, actor, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        tenantId,
        input.ticketId,
        input.action,
        input.fromStatus,
        input.toStatus,
        input.actor,
        input.note ?? null,
        input.createdAt
      );
    },

    listEvents(tenantId: number, ticketId: number) {
      return db
        .prepare(
          `SELECT action, from_status AS fromStatus, to_status AS toStatus, actor, note, created_at AS createdAt
           FROM ticket_events WHERE tenant_id = ? AND ticket_id = ? ORDER BY id`
        )
        .all(tenantId, ticketId);
    },
  };
}

export type TicketRepo = ReturnType<typeof createTicketRepo>;
