import type { Db } from '../../shared/db.ts';
import type { ApplicationSummary, Status } from './types.ts';

interface AppRow {
  id: number;
  apply_no: string;
  item_id: number;
  applicant_name: string;
  applicant_id_no: string;
  applicant_phone: string;
  status: string;
  submitted_at: string;
  accepted_at: string | null;
  concluded_at: string | null;
  licence_no: string | null;
  item_name: string;
  promise_days: number;
}

const BASE_SELECT = `
  SELECT a.*, c.item_name, c.promise_days
  FROM applications a JOIN catalog_items c ON c.id = a.item_id`;

/** 在办状态：超期预警只看这些 */
const ACTIVE_STATUSES = "('accepted','supplementing','in_review','approved')";

export function createApplicationRepo(db: Db) {
  return {
    /** 发号：与建单同一事务内 UPSERT 递增，保证同日不重号 */
    nextApplyNo(divisionCode: string): string {
      // 日期取北京时间（CST=UTC+8，无夏令时）：政务系统按本地自然日归档，
      // 直接用 toISOString 会在 00:00–08:00 CST 落到 UTC 的前一天，编号带错日期。
      const day = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replaceAll('-', '');
      const row = db
        .prepare(
          `INSERT INTO apply_seq (day, seq) VALUES (?, 1)
           ON CONFLICT(day) DO UPDATE SET seq = seq + 1
           RETURNING seq`
        )
        .get(day) as { seq: number };
      return `${divisionCode}-${day}-${String(row.seq).padStart(4, '0')}`;
    },

    insertApplication(input: {
      applyNo: string;
      itemId: number;
      applicantName: string;
      applicantIdNo: string;
      applicantPhone: string;
      submittedAt: string;
    }): number {
      const r = db
        .prepare(
          `INSERT INTO applications
             (apply_no, item_id, applicant_name, applicant_id_no, applicant_phone, status, submitted_at)
           VALUES (?, ?, ?, ?, ?, 'submitted', ?)`
        )
        .run(input.applyNo, input.itemId, input.applicantName, input.applicantIdNo, input.applicantPhone, input.submittedAt);
      return Number(r.lastInsertRowid);
    },

    insertMaterial(applicationId: number, materialName: string, fileRef: string): void {
      db.prepare(
        'INSERT INTO application_materials (application_id, material_name, file_ref) VALUES (?, ?, ?)'
      ).run(applicationId, materialName, fileRef);
    },

    getByApplyNo(applyNo: string): AppRow | undefined {
      return db.prepare(`${BASE_SELECT} WHERE a.apply_no = ?`).get(applyNo) as unknown as AppRow | undefined;
    },

    /**
     * 条件更新：WHERE 带 status = expectedFrom 守卫，返回受影响行数。
     * service 读到的 from 与写入时的库内状态若已被并发改动，本次更新命中 0 行，
     * service 据此抛冲突而非静默覆盖（单进程同步执行掩盖了该 TOCTOU，见 ADR-003）。
     */
    updateStatus(
      id: number,
      expectedFrom: Status,
      to: Status,
      patch: { acceptedAt?: string; concludedAt?: string; licenceNo?: string } = {}
    ): number {
      const r = db
        .prepare(
          `UPDATE applications SET
             status = ?,
             accepted_at  = COALESCE(?, accepted_at),
             concluded_at = COALESCE(?, concluded_at),
             licence_no   = COALESCE(?, licence_no)
           WHERE id = ? AND status = ?`
        )
        .run(to, patch.acceptedAt ?? null, patch.concludedAt ?? null, patch.licenceNo ?? null, id, expectedFrom);
      return r.changes as number;
    },

    /** 审计留痕：只增不改 */
    insertLog(input: {
      applicationId: number;
      action: string;
      fromStatus: string;
      toStatus: string;
      operator: string;
      opinion?: string;
    }): void {
      db.prepare(
        `INSERT INTO approval_logs (application_id, action, from_status, to_status, operator, opinion, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        input.applicationId,
        input.action,
        input.fromStatus,
        input.toStatus,
        input.operator,
        input.opinion ?? null,
        new Date().toISOString()
      );
    },

    listLogs(applicationId: number) {
      return db
        .prepare(
          `SELECT action, from_status AS fromStatus, to_status AS toStatus, operator, opinion, created_at AS createdAt
           FROM approval_logs WHERE application_id = ? ORDER BY id`
        )
        .all(applicationId);
    },

    listMaterials(applicationId: number) {
      return db
        .prepare(
          `SELECT material_name AS materialName, file_ref AS fileRef
           FROM application_materials WHERE application_id = ? ORDER BY id`
        )
        .all(applicationId);
    },

    list(filter: { status?: string; overdue?: boolean }): ApplicationSummary[] {
      const where: string[] = [];
      const params: string[] = [];
      if (filter.status) {
        where.push('a.status = ?');
        params.push(filter.status);
      }
      if (filter.overdue) {
        where.push(`a.status IN ${ACTIVE_STATUSES}`);
        where.push('a.accepted_at IS NOT NULL');
        // 过滤口径与下方 overdueDays 展示口径必须一致：都以"已过整日数"计。
        // CAST(... AS INTEGER) 截断到整日，对齐 JS 的 Math.floor，避免"在列表里但 overdueDays=0"。
        // 演示以自然日近似工作日（承诺时限本为工作日，正文 2.3 节已声明此简化）。
        where.push("CAST(julianday('now') - julianday(a.accepted_at) AS INTEGER) > c.promise_days");
      }
      const sql = `${BASE_SELECT}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.id DESC`;
      const rows = db.prepare(sql).all(...params) as unknown as Array<
        AppRow & { promise_days: number }
      >;
      return rows.map((r) => ({
        applyNo: r.apply_no,
        itemName: r.item_name,
        applicantName: r.applicant_name,
        status: r.status as Status,
        submittedAt: r.submitted_at,
        acceptedAt: r.accepted_at,
        promiseDays: r.promise_days,
        overdueDays: r.accepted_at
          ? Math.max(
              0,
              Math.floor((Date.now() - Date.parse(r.accepted_at)) / 86_400_000) - r.promise_days
            )
          : null,
      }));
    },
  };
}

export type ApplicationRepo = ReturnType<typeof createApplicationRepo>;
