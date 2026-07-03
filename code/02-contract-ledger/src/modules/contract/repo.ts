import type { Db } from '../../shared/db.ts';
import type { Contract, ContractStatus } from './types.ts';

interface Row {
  id: number;
  contract_no: string;
  title: string;
  counterparty: string;
  amount_cents: number;
  sign_date: string;
  effective_date: string;
  expire_date: string;
  owner: string;
  status: string;
  created_at: string;
}

function toContract(r: Row): Contract {
  return {
    id: r.id,
    contractNo: r.contract_no,
    title: r.title,
    counterparty: r.counterparty,
    amountCents: r.amount_cents,
    signDate: r.sign_date,
    effectiveDate: r.effective_date,
    expireDate: r.expire_date,
    owner: r.owner,
    status: r.status as ContractStatus,
    createdAt: r.created_at,
  };
}

export function createContractRepo(db: Db) {
  return {
    /** 发号：与建单同一事务内 UPSERT 递增，保证同年不重号 */
    nextContractNo(year: number): string {
      const row = db
        .prepare(
          `INSERT INTO contract_seq (year, seq) VALUES (?, 1)
           ON CONFLICT(year) DO UPDATE SET seq = seq + 1
           RETURNING seq`
        )
        .get(String(year)) as { seq: number };
      return `HT-${year}-${String(row.seq).padStart(4, '0')}`;
    },

    insert(input: {
      contractNo: string;
      title: string;
      counterparty: string;
      amountCents: number;
      signDate: string;
      effectiveDate: string;
      expireDate: string;
      owner: string;
      createdAt: string;
    }): number {
      const r = db
        .prepare(
          `INSERT INTO contracts
             (contract_no, title, counterparty, amount_cents, sign_date, effective_date, expire_date, owner, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
        )
        .run(
          input.contractNo,
          input.title,
          input.counterparty,
          input.amountCents,
          input.signDate,
          input.effectiveDate,
          input.expireDate,
          input.owner,
          input.createdAt
        );
      return Number(r.lastInsertRowid);
    },

    getByNo(contractNo: string): Contract | undefined {
      const row = db.prepare('SELECT * FROM contracts WHERE contract_no = ?').get(contractNo) as unknown as
        | Row
        | undefined;
      return row ? toContract(row) : undefined;
    },

    getById(id: number): Contract | undefined {
      const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as unknown as Row | undefined;
      return row ? toContract(row) : undefined;
    },

    setStatus(id: number, status: ContractStatus): void {
      db.prepare('UPDATE contracts SET status = ? WHERE id = ?').run(status, id);
    },

    list(filter: { status?: ContractStatus; expireBefore?: string }): Contract[] {
      const where: string[] = [];
      const params: string[] = [];
      if (filter.status) {
        where.push('status = ?');
        params.push(filter.status);
      }
      if (filter.expireBefore) {
        where.push('expire_date <= ?');
        params.push(filter.expireBefore);
      }
      const sql = `SELECT * FROM contracts
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY id DESC`;
      const rows = db.prepare(sql).all(...params) as unknown as Row[];
      return rows.map(toContract);
    },

    /** 零调度器到期提醒：一条 SQL——expire_date 落在 [今天, 今天+days] 的 active 件 */
    reminders(days: number): Array<Contract & { daysLeft: number }> {
      const rows = db
        .prepare(
          `SELECT *, CAST(julianday(expire_date) - julianday(date('now')) AS INTEGER) AS days_left
           FROM contracts
           WHERE status = 'active'
             AND expire_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
           ORDER BY expire_date`
        )
        .all(days) as unknown as Array<Row & { days_left: number }>;
      return rows.map((r) => ({ ...toContract(r), daysLeft: r.days_left }));
    },
  };
}

export type ContractRepo = ReturnType<typeof createContractRepo>;
