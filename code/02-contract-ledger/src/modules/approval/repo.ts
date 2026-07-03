import type { Db } from '../../shared/db.ts';
import type { ApprovalRepo, ApprovalTask, TaskStatus } from './types.ts';

interface Row {
  id: number;
  contract_id: number;
  round: number;
  step_no: number;
  role: string;
  assignee: string;
  status: string;
  opinion: string | null;
  decided_at: string | null;
}

function toTask(r: Row): ApprovalTask {
  return {
    id: r.id,
    contractId: r.contract_id,
    round: r.round,
    stepNo: r.step_no,
    role: r.role,
    assignee: r.assignee,
    status: r.status as TaskStatus,
    opinion: r.opinion,
    decidedAt: r.decided_at,
  };
}

/** ApprovalRepo 端口的 SQLite 实现：只有 SQL，不含业务判断 */
export function createApprovalRepo(db: Db): ApprovalRepo {
  return {
    maxRound(contractId: number): number {
      const row = db
        .prepare('SELECT COALESCE(MAX(round), 0) AS max_round FROM approval_tasks WHERE contract_id = ?')
        .get(contractId) as { max_round: number };
      return row.max_round;
    },

    insertTask(input): number {
      const r = db
        .prepare(
          `INSERT INTO approval_tasks (contract_id, round, step_no, role, assignee, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`
        )
        .run(input.contractId, input.round, input.stepNo, input.role, input.assignee);
      return Number(r.lastInsertRowid);
    },

    getTask(taskId: number): ApprovalTask | undefined {
      const row = db.prepare('SELECT * FROM approval_tasks WHERE id = ?').get(taskId) as unknown as
        | Row
        | undefined;
      return row ? toTask(row) : undefined;
    },

    firstPending(contractId: number, round: number): ApprovalTask | undefined {
      const row = db
        .prepare(
          `SELECT * FROM approval_tasks
           WHERE contract_id = ? AND round = ? AND status = 'pending'
           ORDER BY step_no LIMIT 1`
        )
        .get(contractId, round) as unknown as Row | undefined;
      return row ? toTask(row) : undefined;
    },

    /** 决策：WHERE 带 status = 'pending' 守卫，返回受影响行数——已决策的任务不得被再次改写（TOCTOU 防护）。 */
    decide(taskId: number, status: 'approved' | 'rejected', opinion: string | null, decidedAt: string): number {
      const r = db
        .prepare(
          "UPDATE approval_tasks SET status = ?, opinion = ?, decided_at = ? WHERE id = ? AND status = 'pending'"
        )
        .run(status, opinion, decidedAt, taskId);
      return r.changes as number;
    },

    skipPending(contractId: number, round: number): void {
      db.prepare(
        `UPDATE approval_tasks SET status = 'skipped'
         WHERE contract_id = ? AND round = ? AND status = 'pending'`
      ).run(contractId, round);
    },

    listByContract(contractId: number): ApprovalTask[] {
      const rows = db
        .prepare('SELECT * FROM approval_tasks WHERE contract_id = ? ORDER BY round, step_no')
        .all(contractId) as unknown as Row[];
      return rows.map(toTask);
    },
  };
}
