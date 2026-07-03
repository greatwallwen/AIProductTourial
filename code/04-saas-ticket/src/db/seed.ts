import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../shared/db.ts';
import { config } from '../config.ts';
import { runMigrations } from './migrate.ts';
import { devSeedKeyHex } from './seed-key.ts';
import { createTenantService } from '../modules/tenant/index.ts';
import { createTicketService } from '../modules/ticket/index.ts';
import type { Priority } from '../modules/ticket/index.ts';

/**
 * 种子数据：走 service 层真实调用（注册开通 → 建单 → 流转），不直插业务表。
 * 工单为真实数据——取自三个公开 GitHub 仓库的 issue（每个仓 = 一个租户），
 * title/状态/标签/时间戳均为原始值（见 dataset/MANIFEST.md）。
 * 租户封装（企业名取自仓库所属公司、plan、管理员账号、API Key）为应用内部信息，属演示配置。
 * 铁律：ticket 的 created_at 用 issue 的真实创建时刻回拨；已关闭工单的事件铺在真实的创建→关闭区间内。
 */
const DATASET = join(import.meta.dirname, '..', '..', '..', '..', 'dataset', '04-saas-ticket', 'issues.json');

interface RawIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
  labels: string[];
}
interface RawTenant {
  code: string;
  company: string;
  repo: string;
  issues: RawIssue[];
}

const db = openDb(config.dbPath);
runMigrations(db);

const tenantService = createTenantService({ db });
const ticketService = createTicketService({ db });

// plan 为应用内部信息（GitHub 无对应字段），按演示需要指定
const PLAN: Record<string, 'standard' | 'pro'> = { SUPABASE: 'pro', PRISMA: 'pro', VERCEL: 'standard' };

/** 由 issue 标签映射工单优先级 */
function priorityOf(labels: string[]): Priority {
  const s = labels.join(' ').toLowerCase();
  if (/bug|regression|crash|broken|error|fail/.test(s)) return 'high';
  if (/enhancement|feature|docs|documentation|question|discussion|proposal/.test(s)) return 'low';
  return 'medium';
}
const isBugLike = (labels: string[]) => /bug|regression|crash|broken|error|fail/.test(labels.join(' ').toLowerCase());

/** 把工单的事件回拨到真实时间轴：已关闭 → 铺在 [created, closed] 区间；未关闭 → 自建单起每步 +2h */
function backdate(tenantId: number, ticketNo: string, createdAtMs: number, closedAtMs: number | null): void {
  const iso = (t: number) => new Date(t).toISOString();
  const ticket = db
    .prepare('SELECT id FROM tickets WHERE tenant_id = ? AND ticket_no = ?')
    .get(tenantId, ticketNo) as { id: number };
  const events = db
    .prepare('SELECT id FROM ticket_events WHERE tenant_id = ? AND ticket_id = ? ORDER BY id')
    .all(tenantId, ticket.id) as Array<{ id: number }>;
  const timeAt = (i: number): number => {
    if (closedAtMs !== null && events.length > 1) {
      return createdAtMs + ((closedAtMs - createdAtMs) * i) / (events.length - 1);
    }
    return createdAtMs + i * 7_200_000;
  };
  events.forEach((e, i) => db.prepare('UPDATE ticket_events SET created_at = ? WHERE id = ?').run(iso(timeAt(i)), e.id));
  const updatedAt = events.length ? timeAt(events.length - 1) : createdAtMs;
  db.prepare('UPDATE tickets SET created_at = ?, updated_at = ? WHERE tenant_id = ? AND ticket_no = ?').run(
    iso(createdAtMs),
    iso(updatedAt),
    tenantId,
    ticketNo
  );
}

const tenants = JSON.parse(readFileSync(DATASET, 'utf8')) as RawTenant[];

for (const seed of tenants) {
  const adminEmail = `admin@${seed.code.toLowerCase()}.example.com`;
  const { apiKey } = tenantService.register(
    {
      companyName: seed.company,
      tenantCode: seed.code,
      adminName: `${seed.code} 平台管理员`,
      adminEmail,
      plan: PLAN[seed.code] ?? 'standard',
    },
    { apiKeyHex: devSeedKeyHex(seed.code) }
  );
  const identity = tenantService.authenticate(apiKey);
  if (!identity) throw new Error(`种子租户鉴权自检失败：${seed.code}`);

  for (const issue of seed.issues) {
    const { ticketNo } = ticketService.create(identity, {
      title: issue.title,
      priority: priorityOf(issue.labels),
      createdBy: adminEmail,
    });
    // 状态映射：closed→resolved（start→resolve）；open 且疑似缺陷→in_progress（start）；其余保持 open
    if (issue.state === 'closed') {
      ticketService.transition(identity, ticketNo, { action: 'start', actorEmail: adminEmail });
      ticketService.transition(identity, ticketNo, { action: 'resolve', actorEmail: adminEmail, note: `上游 issue #${issue.number} 已关闭` });
    } else if (isBugLike(issue.labels)) {
      ticketService.transition(identity, ticketNo, { action: 'start', actorEmail: adminEmail });
    }
    backdate(identity.tenantId, ticketNo, Date.parse(issue.createdAt), issue.closedAt ? Date.parse(issue.closedAt) : null);
  }
  console.log(`租户 ${seed.code}（${seed.company}，${PLAN[seed.code] ?? 'standard'}）：${seed.issues.length} 单，开发 API Key ${apiKey}`);
}

const summary = db
  .prepare(
    `SELECT t.tenant_code AS code, COUNT(k.id) AS n,
            SUM(CASE WHEN k.status='resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN k.status='in_progress' THEN 1 ELSE 0 END) AS wip,
            SUM(CASE WHEN k.status='open' THEN 1 ELSE 0 END) AS open
     FROM tenants t LEFT JOIN tickets k ON k.tenant_id = t.id
     GROUP BY t.id ORDER BY t.id`
  )
  .all() as Array<{ code: string; n: number; resolved: number; wip: number; open: number }>;
console.log('租户工单分布：' + summary.map((s) => `${s.code}=${s.n}(open ${s.open}/wip ${s.wip}/resolved ${s.resolved})`).join('，'));
db.close();
