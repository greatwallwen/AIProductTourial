/** 套餐集合：as const 联合类型，与 001_init.sql 的 CHECK 约束逐字一致 */
export const PLANS = ['standard', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export const ROLES = ['admin', 'agent'] as const;
export type Role = (typeof ROLES)[number];

export interface RegisterInput {
  companyName: string;
  /** 大写租户码（如 MINGRUI），进入工单编号前缀与 API Key */
  tenantCode: string;
  adminName: string;
  adminEmail: string;
  plan?: Plan;
}

/** 鉴权成功后写到 request 上的租户身份，工单域一切查询以此为界 */
export interface TenantIdentity {
  tenantId: number;
  tenantCode: string;
}

export interface RegisterResult {
  tenantCode: string;
  companyName: string;
  plan: Plan;
  /** 明文 API Key：仅在本响应中出现一次，库中只存 sha256 哈希 */
  apiKey: string;
  admin: { name: string; email: string; role: 'admin' };
}
