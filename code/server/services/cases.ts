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

/** 后端真实子系统清单（dogfood，案例46/ArchScreen 用）：与 build_case_data 同一目录扫描口径——
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

/** 三维散点真实数据点（three.js 案例）：读经营 CSV → 单价×数量×金额，色=品类。 */
export function points3d() {
  const t = parseCsv(join(ROOT, 'dataset', 'order_data.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [pi, qi, ai, cat] = [ci('单价'), ci('数量'), ci('金额'), ci('品类')];
  const cats = [...new Set(t.rows.map((r) => r[cat]))];
  const pts = t.rows.slice(0, 140).map((r) => ({ x: Number(r[pi]) || 0, y: Number(r[qi]) || 0, z: Number(r[ai]) || 0, c: cats.indexOf(r[cat]) }));
  return { count: pts.length, categories: cats, points: pts };
}

/** 航空会员 RFM 真实分析（案例30 专属 demo 驱动）：从真实列真算分层、高价值流失、R×F 散点。 */
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
  return { total: members.length, segments, churnRisk: churn.length, churnRate: Math.round(churn.length / members.length * 1000) / 10, mHi, rHi, scatter };
}

/** 医院急诊及时性真实分析（案例16，高影响）：真实基座 CMS Timely & Effective Care - Hospital。
 *  按急诊量级(EDV)真算中位急诊等待与未就诊离开率（真实单调效应：量级越高等待越长、流失越高），
 *  定位需增容/分流的高负荷急诊；高影响：系统只建议、不自动改号，保留人工复核。 */
export function hospital() {
  const t = parseCsv(join(ROOT, 'dataset', 'product_cases', 'hospital_ed_timely.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [vol, wait, leave, warn, state] = ['急诊量级', '中位急诊时长分', '未就诊离开率', '运营预警', '州'].map(ci);
  const rows = t.rows;
  const order = { '极高': 0, '高': 1, '中': 2, '低': 3, '极低': 4, '未标注': 5 } as any;
  const dm: Record<string, { n: number; wait: number; leave: number; lc: number }> = {};
  for (const r of rows) { const k = r[vol] || '未标注'; (dm[k] ||= { n: 0, wait: 0, leave: 0, lc: 0 }); const m = dm[k]; m.n++; m.wait += Number(r[wait]) || 0; const lv = r[leave]; if (lv !== '' && lv != null) { m.leave += Number(lv) || 0; m.lc++; } }
  const depts = Object.entries(dm).map(([name, m]) => ({ name, count: m.n, avgWait: Math.round(m.wait / m.n), leaveRate: m.lc ? Math.round(m.leave / m.lc * 10) / 10 : 0 })).sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9));
  const sm: Record<string, number> = {}; for (const r of rows) sm[r[state]] = (sm[r[state]] || 0) + 1;
  const slots = Object.entries(sm).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  const warnRate = Math.round(rows.filter((r) => (r[warn] || '').trim()).length / rows.length * 1000) / 10;
  const avgWaitAll = Math.round(rows.reduce((a, r) => a + (Number(r[wait]) || 0), 0) / rows.length);
  return { total: rows.length, warnRate, avgWaitAll, depts, slots };
}

/** 广告投放漏斗真实分析（案例31 专属 demo）：按渠道聚合曝光→点击→转化，算 CTR/CVR/CPA，找优质/落地页问题渠道。 */
export function adFunnel() {
  const t = parseCsv(join(ROOT, 'dataset', 'reference_data_analysis', '18-ad_performance.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [ch, imp, clk, cvt, cost] = ['渠道', '曝光', '点击', '转化', '花费'].map(ci);
  const cm: Record<string, { imp: number; clk: number; cvt: number; cost: number }> = {};
  for (const r of t.rows) { const k = r[ch] || '—'; (cm[k] ||= { imp: 0, clk: 0, cvt: 0, cost: 0 }); const m = cm[k]; m.imp += Number(r[imp]) || 0; m.clk += Number(r[clk]) || 0; m.cvt += Number(r[cvt]) || 0; m.cost += Number(r[cost]) || 0; }
  const channels = Object.entries(cm).map(([name, m]) => ({ name, imp: m.imp, clk: m.clk, cvt: m.cvt, cost: m.cost, ctr: Math.round(m.clk / Math.max(1, m.imp) * 10000) / 100, cvr: Math.round(m.cvt / Math.max(1, m.clk) * 10000) / 100, cpa: m.cvt ? Math.round(m.cost / m.cvt) : 0 })).sort((a, b) => b.cvr - a.cvr);
  return { channels, best: channels[0]?.name, worst: channels[channels.length - 1]?.name };
}

/** 金融复核真实分析（案例28，高影响）：真实基座 UCI 信用卡客户违约。按额度档真算高风险率（真实反直觉效应：低额度违约率最高）
 *  + 高优先复核队列（高风险×大账单金额）。高影响：保留人工复核，模型不得自动拒付。 */
export function riskReview() {
  const t = parseCsv(join(ROOT, 'dataset', 'reference_data_analysis', '28-credit_default_sample.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [amt, tier, sig, lvl, rev, rules] = ['账单金额', '额度档', '风险信号', '风险等级', '复核', '命中规则数'].map(ci);
  const rows = t.rows;
  const lm: Record<string, { n: number; amt: number }> = {};
  for (const r of rows) { const k = r[lvl] || '—'; (lm[k] ||= { n: 0, amt: 0 }); lm[k].n++; lm[k].amt += Number(r[amt]) || 0; }
  const order = { '高': 0, '中': 1, '低': 2 } as any;
  const levels = Object.entries(lm).map(([name, m]) => ({ name, count: m.n, avgAmt: Math.round(m.amt / m.n) })).sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9));
  // 真实反直觉效应：高风险率按额度档（低额度客户违约率最高）——真数据真算，非噪声
  const tm: Record<string, { n: number; hi: number }> = {};
  for (const r of rows) { const k = r[tier] || '—'; (tm[k] ||= { n: 0, hi: 0 }); tm[k].n++; if (r[lvl] === '高') tm[k].hi++; }
  const torder = { '低额度': 0, '中额度': 1, '高额度': 2 } as any;
  const tiers = Object.entries(tm).map(([name, m]) => ({ name, count: m.n, highRate: Math.round(m.hi / m.n * 1000) / 10 })).sort((a, b) => (torder[a.name] ?? 9) - (torder[b.name] ?? 9));
  const priority = rows.filter((r) => r[lvl] === '高').map((r) => ({ txn: r[0], amt: Number(r[amt]) || 0, tier: r[tier], sig: r[sig], rules: Number(r[rules]) || 0 })).sort((a, b) => b.amt - a.amt).slice(0, 8);
  const total = rows.length;
  const highRate = Math.round(rows.filter((r) => r[lvl] === '高').length / total * 1000) / 10;
  const reviewRate = Math.round(rows.filter((r) => /待复核/.test(r[rev] || '')).length / total * 1000) / 10;
  return { total, highRate, reviewRate, levels, tiers, priority };
}

/** 航班准点运营真实分析（案例14）：真实基座 US DOT On-Time Performance（公共领域）。
 *  按真实起飞城市聚合延误率/取消率/均延误 + 延误原因分布，定位需增容/调度的高延误枢纽。全部真实，无合成叠加。
 *  (cities 字段=起飞城市聚合；expandRate 字段承载「取消率」以复用前端渲染。) */
export function dispatch() {
  const t = parseCsv(join(ROOT, 'dataset', 'product_cases', 'flights_ontime.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [city, plan, actual, anom, cause] = ['城市', '计划时效h', '实际时效h', '异常类型', '责任方'].map(ci);
  const rows = t.rows;
  const cm: Record<string, { n: number; late: number; delay: number; cancel: number }> = {};
  for (const r of rows) { const k = r[city] || '—'; (cm[k] ||= { n: 0, late: 0, delay: 0, cancel: 0 }); const m = cm[k]; m.n++; if (r[anom] === '延误') { m.late++; const p = Number(r[plan]) || 0, a = Number(r[actual]) || 0; if (a > p) m.delay += (a - p) * 60; } if (r[anom] === '取消') m.cancel++; }
  const cities = Object.entries(cm).filter(([, m]) => m.n >= 8).map(([name, m]) => ({ name, count: m.n, lateRate: Math.round(m.late / m.n * 1000) / 10, avgDelay: m.late ? Math.round(m.delay / m.late) : 0, expandRate: Math.round(m.cancel / m.n * 1000) / 10 })).sort((a, b) => b.lateRate - a.lateRate);
  // 延误原因分布（真实，仅延误航班有原因）
  const am: Record<string, number> = {}; for (const r of rows) { if (r[anom] !== '延误') continue; const k = r[cause] || '其他'; am[k] = (am[k] || 0) + 1; }
  const anomalies = Object.entries(am).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const total = rows.length, lateRate = Math.round(rows.filter((r) => r[anom] === '延误').length / total * 1000) / 10;
  return { total, lateRate, cities, anomalies };
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
