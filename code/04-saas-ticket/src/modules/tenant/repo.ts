import type { Db } from '../../shared/db.ts';
import type { Plan, Role } from './types.ts';

interface TenantRow {
  id: number;
  tenant_code: string;
  company_name: string;
  plan: string;
  api_key_hash: string;
  created_at: string;
}

export function createTenantRepo(db: Db) {
  return {
    insertTenant(input: {
      tenantCode: string;
      companyName: string;
      plan: Plan;
      apiKeyHash: string;
      createdAt: string;
    }): number {
      const r = db
        .prepare(
          `INSERT INTO tenants (tenant_code, company_name, plan, api_key_hash, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(input.tenantCode, input.companyName, input.plan, input.apiKeyHash, input.createdAt);
      return Number(r.lastInsertRowid);
    },

    insertUser(tenantId: number, name: string, email: string, role: Role): void {
      db.prepare('INSERT INTO users (tenant_id, name, email, role) VALUES (?, ?, ?, ?)').run(
        tenantId,
        name,
        email,
        role
      );
    },

    /** 发号器就位：seq=0，此后建单只做 UPDATE 递增——行不存在即注册事务未完整执行 */
    initTicketSeq(tenantId: number): void {
      db.prepare('INSERT INTO ticket_seq (tenant_id, seq) VALUES (?, 0)').run(tenantId);
    },

    findByCode(tenantCode: string): TenantRow | undefined {
      return db.prepare('SELECT * FROM tenants WHERE tenant_code = ?').get(tenantCode) as unknown as
        | TenantRow
        | undefined;
    },

    /** 鉴权查询：只认哈希，明文 Key 从不进入 SQL */
    findByApiKeyHash(hash: string): TenantRow | undefined {
      return db.prepare('SELECT * FROM tenants WHERE api_key_hash = ?').get(hash) as unknown as
        | TenantRow
        | undefined;
    },
  };
}

export type TenantRepo = ReturnType<typeof createTenantRepo>;
