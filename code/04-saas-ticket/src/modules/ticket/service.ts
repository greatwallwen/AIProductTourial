import type { Db } from '../../shared/db.ts';
import { withTransaction } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import { createTicketRepo } from './repo.ts';
import type { Action, CreateTicketInput, Status, TenantContext } from './types.ts';

/**
 * 状态机是一等公民数据结构：合法迁移只在这张表里。
 * 边名与接口 action、状态机 SVG 图逐字一致（图码同源）。
 */
export const TRANSITIONS: Record<Action, { from: Status; to: Status }> = {
  start: { from: 'open', to: 'in_progress' },
  resolve: { from: 'in_progress', to: 'resolved' },
  reopen: { from: 'resolved', to: 'in_progress' },
  close: { from: 'resolved', to: 'closed' },
};

export function allowedActionsFrom(status: Status): Action[] {
  return (Object.keys(TRANSITIONS) as Action[]).filter((a) => TRANSITIONS[a].from === status);
}

export function createTicketService(deps: { db: Db }) {
  const repo = createTicketRepo(deps.db);

  /** 统一 404：查无与他租户资源同响应，不泄露资源存在性 */
  function mustGet(tenant: TenantContext, ticketNo: string) {
    const record = repo.getByTicketNo(tenant.tenantId, ticketNo);
    if (!record) throw new AppError('TICKET_NOT_FOUND', 404, `工单不存在：${ticketNo}`);
    return record;
  }

  return {
    /** 建单：发号与写入同一事务，编号 {TENANT_CODE}-0001 每租户独立递增 */
    create(tenant: TenantContext, input: CreateTicketInput) {
      return withTransaction(deps.db, () => {
        const ticketNo = repo.nextTicketNo(tenant.tenantId, tenant.tenantCode);
        const now = new Date().toISOString();
        const id = repo.insertTicket(tenant.tenantId, {
          ticketNo,
          title: input.title,
          priority: input.priority,
          assignee: input.assignee,
          createdBy: input.createdBy,
          createdAt: now,
        });
        repo.insertEvent(tenant.tenantId, {
          ticketId: id,
          action: 'created',
          fromStatus: '-',
          toStatus: 'open',
          actor: input.createdBy,
          createdAt: now,
        });
        return { ticketNo, status: 'open' as const };
      });
    },

    /** 流转：非法迁移拒绝并告知当前状态下允许的动作 */
    transition(tenant: TenantContext, ticketNo: string, input: { action: Action; actorEmail: string; note?: string }) {
      const record = mustGet(tenant, ticketNo);
      const t = TRANSITIONS[input.action];
      const current = record.status as Status;
      if (t.from !== current) {
        throw new AppError('ILLEGAL_TRANSITION', 409, `当前状态 ${current} 不允许动作 ${input.action}`, {
          currentStatus: current,
          allowedActions: allowedActionsFrom(current),
        });
      }

      const now = new Date().toISOString();
      withTransaction(deps.db, () => {
        const changed = repo.updateStatus(tenant.tenantId, record.id, current, t.to, {
          updatedAt: now,
          // 开始处理即认领：无人认领的工单由动作执行人接手
          assignee: input.action === 'start' && !record.assignee ? input.actorEmail : undefined,
        });
        if (changed === 0) {
          throw new AppError('CONCURRENT_MODIFICATION', 409, `工单 ${ticketNo} 已被并发修改，请重试`, {
            expectedStatus: current,
          });
        }
        repo.insertEvent(tenant.tenantId, {
          ticketId: record.id,
          action: input.action,
          fromStatus: current,
          toStatus: t.to,
          actor: input.actorEmail,
          note: input.note,
          createdAt: now,
        });
      });
      return { ticketNo, status: t.to };
    },

    detail(tenant: TenantContext, ticketNo: string) {
      const record = mustGet(tenant, ticketNo);
      return {
        ticketNo: record.ticket_no,
        title: record.title,
        priority: record.priority,
        status: record.status as Status,
        assignee: record.assignee,
        createdBy: record.created_by,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        events: repo.listEvents(tenant.tenantId, record.id),
      };
    },

    list(tenant: TenantContext, filter: { status?: string; priority?: string }) {
      return repo.list(tenant.tenantId, filter);
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;
