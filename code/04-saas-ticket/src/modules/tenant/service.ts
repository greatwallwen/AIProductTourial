import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../../shared/db.ts';
import { withTransaction } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import { createTenantRepo } from './repo.ts';
import type { RegisterInput, RegisterResult, TenantIdentity } from './types.ts';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Key 格式：wd_{tenantCode 小写}_{24hex}。随机部分取 128-bit（32 hex）截前 24 位。 */
function buildApiKey(tenantCode: string, hex24: string): string {
  return `wd_${tenantCode.toLowerCase()}_${hex24}`;
}

export function createTenantService(deps: { db: Db }) {
  const repo = createTenantRepo(deps.db);

  return {
    /**
     * 租户开通是单事务：租户 + admin 用户 + 工单发号器，三者要么全有要么全无。
     * 明文 Key 只在返回值中出现一次；库中只落 sha256 哈希（丢了只能重置，无法找回）。
     * opts.apiKeyHex 仅供种子脚本注入可复现 Key，HTTP 路由永远不传。
     */
    register(input: RegisterInput, opts: { apiKeyHex?: string } = {}): RegisterResult {
      if (repo.findByCode(input.tenantCode)) {
        throw new AppError('TENANT_CODE_TAKEN', 409, `租户码已被占用：${input.tenantCode}`);
      }
      const plan = input.plan ?? 'standard';
      const apiKey = buildApiKey(input.tenantCode, opts.apiKeyHex ?? randomBytes(16).toString('hex').slice(0, 24));

      withTransaction(deps.db, () => {
        const tenantId = repo.insertTenant({
          tenantCode: input.tenantCode,
          companyName: input.companyName,
          plan,
          apiKeyHash: sha256Hex(apiKey),
          createdAt: new Date().toISOString(),
        });
        repo.insertUser(tenantId, input.adminName, input.adminEmail, 'admin');
        repo.initTicketSeq(tenantId);
      });

      return {
        tenantCode: input.tenantCode,
        companyName: input.companyName,
        plan,
        apiKey,
        admin: { name: input.adminName, email: input.adminEmail, role: 'admin' },
      };
    },

    /** 鉴权：sha256(明文 Key) 查表。查无即无效，不区分「不存在」与「格式错」。 */
    authenticate(apiKey: string): TenantIdentity | null {
      const row = repo.findByApiKeyHash(sha256Hex(apiKey));
      return row ? { tenantId: row.id, tenantCode: row.tenant_code } : null;
    },
  };
}

export type TenantService = ReturnType<typeof createTenantService>;
