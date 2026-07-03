import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, withTransaction } from '../shared/db.ts';
import { config } from '../config.ts';
import { runMigrations } from './migrate.ts';
import { createContractService } from '../modules/contract/index.ts';
import { createApprovalService, createApprovalRepo } from '../modules/approval/index.ts';

/**
 * 种子数据：相对方企业名拟真但虚构，金额为演示值；相对方注册地为 GB/T 2260 真实行政区划
 * （dataset/02-contract-ledger/regions.json，见 dataset/MANIFEST.md），种子据此校验名称前缀。
 * 印花税税率为《印花税法》真实法定税率。
 * 铁律一：时间字段一律相对 Date.now() 偏移，保证到期提醒演示任何日期运行都真实命中。
 * 铁律二：数据一律走 service 层真实流程（起草→提交→按序审批）生成——
 *         业务日期（签订/生效/到期）是起草入参，直接给相对偏移值；
 *         created_at / decided_at 由系统生成，事后用 SQL 回拨，让台账看起来有历史。
 */
const db = openDb(config.dbPath);
runMigrations(db);

// GB/T 2260 真实行政区划：用于校验相对方注册地前缀真实存在
const REGIONS = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'dataset', '02-contract-ledger', 'regions.json'), 'utf8')
) as Array<{ code: string; name: string; level: string }>;
const shortToRegion = new Map<string, { name: string; level: string }>();
for (const r of REGIONS) {
  const short = r.name.replace(/(省|市|自治区|特别行政区|自治州|地区|盟)$/, '');
  if (short && !shortToRegion.has(short)) shortToRegion.set(short, r);
}
/** 从相对方名称前缀解析真实注册地（取能匹配的最长真实区划短名） */
function registrationOf(counterparty: string): { name: string; level: string } {
  const hit = [...shortToRegion.keys()]
    .filter((s) => counterparty.startsWith(s))
    .sort((a, b) => b.length - a.length)[0];
  if (!hit) throw new Error(`相对方注册地前缀不在真实行政区划内：${counterparty}`);
  return shortToRegion.get(hit)!;
}

const contract = createContractService({ db });
const approval = createApprovalService({
  repo: createApprovalRepo(db),
  contracts: contract,
  tx: (fn) => withTransaction(db, fn),
});

/** 相对今天偏移 n 天的 YYYY-MM-DD（UTC，与 SQL date('now') 同基准） */
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const OPINIONS: Record<string, string> = {
  法务: '合同条款审查通过，权利义务对等',
  部门负责人: '在部门年度预算范围内，同意',
  分管副总: '供应商资质与报价合理，同意',
  总经理: '同意签署',
};

interface SeedContract {
  title: string;
  counterparty: string;
  amount: string; // 元字符串
  owner: string;
  signOffset: number;
  effectiveOffset: number;
  expireOffset: number;
  /** 通过多少步审批：'all' → 走完整条链变 active */
  approveSteps: number | 'all';
  /** created_at 回拨天数（decided_at 依次 +1 天） */
  createdDaysAgo: number;
}

const CONTRACTS: SeedContract[] = [
  {
    title: '2026年度办公用品框架采购合同',
    counterparty: '上海浦江印务有限公司',
    amount: '86400.00', // <10万 → 2 步链
    owner: '行政部-刘婷',
    signOffset: -190,
    effectiveOffset: -185,
    expireOffset: 180,
    approveSteps: 'all',
    createdDaysAgo: 190,
  },
  {
    title: 'IDC机房托管服务合同（2026-2027）',
    counterparty: '杭州云栖鸿图网络科技有限公司',
    amount: '486000.00', // ≥10万 → 3 步链
    owner: '信息部-陈凯',
    signOffset: -345,
    effectiveOffset: -340,
    expireOffset: 25, // 30 天提醒窗口内 → 提醒命中
    approveSteps: 'all',
    createdDaysAgo: 345,
  },
  {
    title: '华东区仓储物流外包服务合同',
    counterparty: '苏州汇达仓储服务有限公司',
    amount: '1280000.00', // ≥100万 → 4 步链
    owner: '供应链部-赵一鸣',
    signOffset: -358,
    effectiveOffset: -353,
    expireOffset: 12, // 30 天提醒窗口内 → 提醒命中
    approveSteps: 'all',
    createdDaysAgo: 358,
  },
  {
    title: '厂房租赁合同（金山园区B栋）',
    counterparty: '上海金山工业园区发展有限公司',
    amount: '660000.00', // ≥10万 → 3 步链
    owner: '生产部-孙国强',
    signOffset: -50,
    effectiveOffset: -45,
    expireOffset: 320,
    approveSteps: 'all',
    createdDaysAgo: 50,
  },
  {
    title: 'ERP系统运维服务合同',
    counterparty: '南京慧算软件技术有限公司',
    amount: '98000.00', // <10万 → 2 步链
    owner: '信息部-陈凯',
    signOffset: -380,
    effectiveOffset: -375,
    expireOffset: -10, // 已过期：台账派生 expired，且不进提醒
    approveSteps: 'all',
    createdDaysAgo: 380,
  },
  {
    title: '华东区仓储物流外包服务合同（二期）',
    counterparty: '苏州汇达仓储服务有限公司',
    amount: '1280000.00', // ≥100万 → 4 步链
    owner: '供应链部-赵一鸣',
    signOffset: -3,
    effectiveOffset: 12,
    expireOffset: 377,
    approveSteps: 2, // 前 2 步已通过 → 停在第 3 步，待分管副总李雪梅决策
    createdDaysAgo: 3,
  },
];

for (const seed of CONTRACTS) {
  const { contractNo } = contract.draft({
    title: seed.title,
    counterparty: seed.counterparty,
    amount: seed.amount,
    signDate: day(seed.signOffset),
    effectiveDate: day(seed.effectiveOffset),
    expireDate: day(seed.expireOffset),
    owner: seed.owner,
  });
  approval.submit(contractNo);

  const chainLength = approval.listChain(contractNo).tasks.length;
  const steps = seed.approveSteps === 'all' ? chainLength : seed.approveSteps;
  for (let i = 0; i < steps; i++) {
    const current = approval.listChain(contractNo).tasks.find((t) => t.status === 'pending')!;
    approval.decide(current.id, {
      decision: 'approve',
      operator: current.assignee,
      opinion: OPINIONS[current.role],
    });
  }

  // 回拨系统时间字段：created_at 与各步 decided_at（业务日期已按相对偏移写入，无需回拨）
  const createdAt = new Date(Date.now() - seed.createdDaysAgo * 86_400_000).toISOString();
  db.prepare('UPDATE contracts SET created_at = ? WHERE contract_no = ?').run(createdAt, contractNo);
  for (const task of approval.listChain(contractNo).tasks) {
    if (!task.decidedAt) continue;
    const decidedAt = new Date(Date.parse(createdAt) + task.stepNo * 86_400_000).toISOString();
    db.prepare('UPDATE approval_tasks SET decided_at = ? WHERE id = ?').run(decidedAt, task.id);
  }

  const view = contract.detail(contractNo);
  const pending = approval.listChain(contractNo).tasks.find((t) => t.status === 'pending');
  const progress =
    view.status === 'approving' && pending
      ? `，停在第 ${pending.stepNo} 步待${pending.role} ${pending.assignee}决策`
      : `，${chainLength} 步链全部通过`;
  console.log(
    `已生成合同 ${contractNo}（${seed.title}，¥${Number(view.amount).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
    })}，${view.derivedStatus}${progress}）`
  );
}

const summary = db
  .prepare('SELECT status, COUNT(*) AS n FROM contracts GROUP BY status ORDER BY status')
  .all() as Array<{ status: string; n: number }>;
console.log('状态分布：' + summary.map((s) => `${s.status}=${s.n}`).join(', '));

const reminders = contract.reminders(30);
console.log(
  `30 天内到期提醒：${reminders.length} 件（${reminders
    .map((r) => `${r.contractNo} 剩 ${r.daysLeft} 天`)
    .join('、')}）`
);

// 相对方注册地：逐一据 GB/T 2260 真实区划校验名称前缀（任一不匹配即抛错）
const parties = [...new Set(CONTRACTS.map((c) => c.counterparty))];
console.log(
  `相对方注册地（GB/T 2260 校验通过 ${parties.length} 家）：` +
    parties.map((p) => `${p} → ${registrationOf(p).name}`).join('；')
);

// 印花税示例：买卖合同法定税率 万分之三（《中华人民共和国印花税法》税目税率表）
const purchase = CONTRACTS.find((c) => /采购|买卖|购销/.test(c.title));
if (purchase) {
  const amt = Number(purchase.amount);
  console.log(
    `印花税示例（买卖合同 万分之三）：${purchase.title} ¥${amt.toLocaleString('zh-CN')} → 应纳印花税 ¥${(amt * 0.0003).toFixed(2)}`
  );
}
db.close();
