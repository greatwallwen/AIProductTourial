import { createHash } from 'node:crypto';

/**
 * 开发种子专用 API Key 的唯一派生处（seed 与 smoke 共用，杜绝公式三处复制后漂移）。
 * 随机部分取 sha256(tenantCode + 'seed-salt') 前 24 hex：固定可复现，每次 db:reset 后不变。
 * 生产注册永远走真随机，与此无关。
 */
export function devSeedKeyHex(tenantCode: string): string {
  return createHash('sha256').update(`${tenantCode}seed-salt`).digest('hex').slice(0, 24);
}

/** 完整明文 Key：wd_{小写租户码}_{24 hex}。README 引用的三把 Key 由此生成。 */
export function devSeedApiKey(tenantCode: string): string {
  return `wd_${tenantCode.toLowerCase()}_${devSeedKeyHex(tenantCode)}`;
}
