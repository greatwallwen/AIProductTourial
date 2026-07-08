import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../data/csv.ts';
/** 业务层：读 case_definitions + 实时读数据集 CSV 计算案例视图（不碰 HTTP 上下文）。 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
const defs = JSON.parse(readFileSync(join(ROOT, 'code', 'tools', 'case_definitions.json'), 'utf8'));

export function listCases() {
  return defs.cases.map((c: any) => ({ num: c.num, title: c.title, industry: c.industry, phase: c.phase, design: c.design, uiId: c.uiId, saasType: c.saasType, graphicOnly: !!c.graphicOnly, demonstrates: c.demonstrates }));
}

/** 案例列表索引（前端侧栏/总览用）：读 build_case_data 的 index.json（真实数据派生）。 */
export function getIndex() {
  return JSON.parse(readFileSync(join(ROOT, 'code', 'data', 'index.json'), 'utf8'));
}

/** 后端真实子系统清单（dogfood，案例06/ArchScreen 用）：与 build_case_data 同一目录扫描口径——
 *  code/server 下的业务子系统目录，排除 tests(是 Loop 的 checker，非子系统)/node_modules/dist。真值单一来源，前端不再硬编码。 */
const SUBSYS_DESC: Record<string, string> = {
  routes: 'HTTP 层：只做输入输出，不写业务', services: '业务层：实时读 CSV 计算，不碰 HTTP',
  data: '数据装载：CSV 解析', db: 'node:sqlite 真关系库（PG 架构）', vector: '纯 JS 真实向量库（RAG）',
};
export function serverSubsystems() {
  const sdir = join(ROOT, 'code', 'server');
  const mods = readdirSync(sdir).filter((e) => { try { return statSync(join(sdir, e)).isDirectory() && !['tests', 'node_modules', 'dist'].includes(e); } catch { return false; } });
  return mods.map((name) => ({ name, desc: SUBSYS_DESC[name] || '' }));
}

/** 案例06 真实架构模型（dogfood）：扫 code/server 各子系统 .ts 的 import → 真实依赖边 + 循环依赖检测 + 一份真 ADR/契约。 */
function walkTs(dir: string): string[] {
  const out: string[] = [];
  try { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) { if (!['node_modules', 'dist'].includes(e)) out.push(...walkTs(p)); } else if (e.endsWith('.ts')) out.push(p); } } catch { /* 目录不存在忽略 */ }
  return out;
}
export function archModel() {
  const sdir = join(ROOT, 'code', 'server');
  const subs = serverSubsystems().map((s) => s.name);
  const edgeSet = new Set<string>();
  for (const sub of subs) {
    for (const f of walkTs(join(sdir, sub))) {
      const imps = readFileSync(f, 'utf8').match(/from\s+'[^']+'/g) || [];
      for (const imp of imps) for (const other of subs) if (other !== sub && new RegExp(`/${other}/|\\.\\./${other}\\b`).test(imp)) edgeSet.add(sub + '>' + other);
    }
  }
  const edges = [...edgeSet].map((e) => { const [from, to] = e.split('>'); return { from, to }; });
  const cycles = edges.filter((e) => edgeSet.has(e.to + '>' + e.from)).length / 2;
  return {
    subsystems: serverSubsystems(), edges, cycles,
    adr: { id: 'ADR-001', title: '本地 node:sqlite，生产标注为 PostgreSQL', why: '同时满足约束「一条命令起、零外部依赖、离线可跑」与「教学要讲 PG/pgvector 架构」；重估信号：需真并发或 pgvector 召回则切 PG。' },
    contract: { envelope: '{ code, message, details } 统一错误信封', idempotent: '写操作幂等：同一「创建」重发不产生两条', openapi: '/api/openapi.json 由路由 schema 自动生成，契约即代码永不漂移' },
  };
}

/** 案例完整视图模型：取真实数据派生的 VM，并实时读 CSV 复算行数/异常数（证明后端真算而非纯静态）。 */
export function caseData(num: number) {
  const c = defs.cases.find((x: any) => x.num === num);
  if (!c) return null;
  const vmPath = join(ROOT, 'code', 'data', `case_${String(num).padStart(2, '0')}.json`);
  let vm: any = {};
  try { vm = JSON.parse(readFileSync(vmPath, 'utf8')); } catch { vm = { num: c.num, title: c.title }; }
  if (c.dataset.endsWith('.csv')) {
    const t = parseCsv(join(ROOT, c.dataset));
    vm.rowCount = t.rows.length; // 实时
    // 异常列取 build 阶段解析并写入 case_NN.json 的 abColumn（单一真源），不再各自用正则猜——
    // 修此前 bug：server 正则会把 hospital 常量列「复核标记」当异常列 → live 算 520(100%) 与横幅「爽约 11.7%」自相矛盾。
    const abName: string | null = vm.abColumn ?? null;
    const abIdx = abName ? t.head.indexOf(abName) : -1;
    vm.exceptionCount = abIdx >= 0
      ? t.rows.filter((r) => { const v = (r[abIdx] || '').trim(); return v && !/正常|免复核|否|已完成|Closed|低/.test(v); }).length
      : (vm.exceptionCount || 0);
    vm.liveComputed = true;
  }
  vm.graphicOnly = !!c.graphicOnly;
  vm.screen = c.screen || null; // 特殊案例屏：rag/db/arch/3d
  vm.demonstrates = c.demonstrates;
  vm.lenses = c.lenses || [];          // Phase 2：角色镜头（研发/产品/项目）
  vm.lensViews = c.lensViews || null;  // 01/41：同一案例的三视角
  return vm;
}

/** 航空会员 RFM 真实分析（案例02 专属 demo 驱动）：从真实列真算分层、高价值流失、R×F 散点。 */
export function rfm() {
  const t = parseCsv(join(ROOT, 'dataset', 'reference_data_analysis', '2-air_data.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [rC, fC, mC, segC] = ['最近乘机天数', '年飞行次数', '年消费', '分层'].map(ci);
  const members = t.rows.map((r) => ({ r: Number(r[rC]) || 0, f: Number(r[fC]) || 0, m: Number(r[mC]) || 0, seg: (r[segC] || '未分层').trim() }));
  const segMap: Record<string, { count: number; spend: number }> = {};
  for (const mem of members) { (segMap[mem.seg] ||= { count: 0, spend: 0 }); segMap[mem.seg].count++; segMap[mem.seg].spend += mem.m; }
  const segments = Object.entries(segMap).map(([name, v]) => ({ name, count: v.count, avgSpend: Math.round(v.spend / v.count) })).sort((a, b) => b.avgSpend - a.avgSpend);
  // 高价值流失：M 前 40% 且 R 后 40%（久未乘机）
  const q = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length * p)]; };
  const mHi = q(members.map((x) => x.m), 0.6), rHi = q(members.map((x) => x.r), 0.6);
  const churn = members.filter((x) => x.m >= mHi && x.r >= rHi);
  const scatter = members.filter((_, i) => i % 4 === 0).slice(0, 140).map((x) => ({ x: x.r, y: x.f, m: x.m, seg: x.seg }));
  // v18-P1 真实对照：UCI 快照 CustomerID 级真算 RFM（2b-real_rfm.csv，全真实；分层为规则派生）
  const rt = parseCsv(join(ROOT, 'dataset', 'reference_data_analysis', '2b-real_rfm.csv'));
  const rci = (n: string) => rt.head.indexOf(n);
  const [rr, rf, rm, rseg] = ['最近购买天数', '购买次数', '总消费', '分层(规则派生)'].map(rci);
  const real = rt.rows.map((r) => ({ r: Number(r[rr]) || 0, f: Number(r[rf]) || 0, m: Number(r[rm]) || 0, seg: r[rseg] || '' }));
  const realScatter = real.filter((_, i) => i % 8 === 0).slice(0, 140).map((x) => ({ x: x.r, y: x.f, m: x.m, seg: x.seg }));
  const realSegs: Record<string, number> = {}; for (const x of real) realSegs[x.seg] = (realSegs[x.seg] || 0) + 1;
  return { total: members.length, segments, churnRisk: churn.length, churnRate: Math.round(churn.length / members.length * 1000) / 10, mHi, rHi, scatter,
    realRef: { total: real.length, scatter: realScatter, segments: Object.entries(realSegs).map(([name, count]) => ({ name, count })), note: '真实对照：UCI 零售快照客户级 RFM 真算（R/F/M 全真实，分层为分位规则派生）' } };
}

/** 零售经营真实分析（案例01 专属 demo）：品类销售额/毛利率/异常率 + 异常订单 triage（按金额）。 */
export function retail() {
  const t = parseCsv(join(ROOT, 'dataset', 'order_data.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [cat, region, amt, margin, anom, resp, sku] = ['品类', '区域', '金额', '毛利率', '异常原因', '责任人', 'SKU'].map(ci);
  const rows = t.rows;
  const cm: Record<string, { amt: number; margin: number; n: number; anom: number }> = {};
  for (const r of rows) { const k = r[cat] || '—'; (cm[k] ||= { amt: 0, margin: 0, n: 0, anom: 0 }); const m = cm[k]; m.amt += Number(r[amt]) || 0; m.margin += Number(r[margin]) || 0; m.n++; if ((r[anom] || '').trim()) m.anom++; }
  const cats = Object.entries(cm).map(([name, m]) => { let mg = m.margin / m.n; if (mg <= 1) mg *= 100; return { name, revenue: Math.round(m.amt), avgMargin: Math.round(mg * 10) / 10, anomRate: Math.round(m.anom / m.n * 1000) / 10 }; }).sort((a, b) => b.revenue - a.revenue);
  const triage = rows.filter((r) => (r[anom] || '').trim()).map((r) => ({ sku: r[sku], cat: r[cat], region: r[region], amt: Number(r[amt]) || 0, reason: r[anom], resp: r[resp] })).sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt)).slice(0, 8);
  return { total: rows.length, anomCount: rows.filter((r) => (r[anom] || '').trim()).length, cats, triage };
}
