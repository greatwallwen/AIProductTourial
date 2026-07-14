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
  // v24：真实国产开源项目对照——若依 RuoYi-Cloud（22 模块/28 依赖边/0 循环/3 Feign 接口契约，pom+@FeignClient 确定性解析）
  const ruoyi = JSON.parse(readFileSync(join(ROOT, 'dataset', 'real', 'ruoyi_cloud_arch.json'), 'utf8'));
  return {
    subsystems: serverSubsystems(), edges, cycles, ruoyi,
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
  vm.screen = c.screen || null; // 特殊案例屏：rag/db/arch/credit
  vm.grill = c.grill || null;   // v22：grill-me 苏格拉底追问（锚真实数据，见 grill.tsx）
  vm.grillLesson = c.grillLesson || null; // v23：追问通关后的「所以真正的一课」收口
  vm.demonstrates = c.demonstrates;
  vm.lenses = c.lenses || [];          // Phase 2：角色镜头（研发/产品/项目）
  vm.lensViews = c.lensViews || null;  // 01/41：同一案例的三视角
  return vm;
}

/** 大陆 P2P 信贷·信用画像分层真实分析（案例02 专属 demo）：从人人贷(CC0)真实列真算分层/放款转化/风险队列/文案信号。
 *  标的 = 放款成功（是否融到款），**非违约**——不可据此推断还款能力（详见案例正文 pitfall）。 */
export function creditSegment() {
  const t = parseCsv(join(ROOT, 'dataset', 'reference_data_analysis', 'p2p_credit.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [okC, amtC, hcC, limC, repC, lenC, portC, riskC] = ['放款成功', '借款金额', '历史成功次数', '授信额度', '有征信报告', '描述字数', '信用画像', '风险信号'].map(ci);
  const rows = t.rows.map((r) => ({ ok: Number(r[okC]) || 0, amt: Number(r[amtC]) || 0, hc: Number(r[hcC]) || 0, lim: Number(r[limC]) || 0, rep: (r[repC] || '').trim(), len: Number(r[lenC]) || 0, port: (r[portC] || '未分层').trim(), risk: (r[riskC] || '').trim() }));
  const total = rows.length;
  const fundRate = Math.round(rows.filter((x) => x.ok).length / total * 1000) / 10;
  // 信用画像分层 → 放款成功率 + 平均借款金额（差异化处置的抓手）
  const order = ['优质', '成长', '待观察', '薄档'];
  const segMap: Record<string, { count: number; ok: number; amt: number }> = {};
  for (const x of rows) { (segMap[x.port] ||= { count: 0, ok: 0, amt: 0 }); const s = segMap[x.port]; s.count++; s.ok += x.ok; s.amt += x.amt; }
  const segments = order.filter((n) => segMap[n]).map((name) => ({ name, count: segMap[name].count, fundRate: Math.round(segMap[name].ok / segMap[name].count * 1000) / 10, avgAmount: Math.round(segMap[name].amt / segMap[name].count) }));
  // 风险队列：薄档/待观察（风险信号非空）→ 走人工复核
  const risk = rows.filter((x) => x.risk);
  // 授信额度 × 历史成功次数 散点，色分信用画像（抽样展示）
  const scatter = rows.filter((_, i) => i % 20 === 0).slice(0, 140).map((x) => ({ x: x.lim, y: x.hc, seg: x.port, ok: x.ok }));
  // 反直觉真实信号：借款描述文案长度分桶 → 放款成功率（文案即转化，但相关≠因果）
  const buckets: [number, number, string][] = [[0, 80, '很短(<80字)'], [80, 160, '偏短(80-160)'], [160, 240, '适中(160-240)'], [240, 1e9, '较长(>240)']];
  const textSignal = buckets.map(([lo, hi, label]) => { const g = rows.filter((x) => x.len >= lo && x.len < hi); return { label, count: g.length, fundRate: g.length ? Math.round(g.filter((x) => x.ok).length / g.length * 1000) / 10 : 0 }; });
  // v24 细分需求：新客（历史成功次数=1，本真集下限）vs 复借（≥2）差异化放款——同一 CC0 真集现成字段；
  // 实测该列 min=1/max=32（无 0），故按数据真实分位切「新客 vs 复借」，不臆造「首贷=0」。
  const frStat = (arr: typeof rows) => ({ count: arr.length, fundRate: arr.length ? Math.round(arr.filter((x) => x.ok).length / arr.length * 1000) / 10 : 0, avgAmount: arr.length ? Math.round(arr.reduce((a, x) => a + x.amt, 0) / arr.length) : 0, repRate: arr.length ? Math.round(arr.filter((x) => x.rep === '有').length / arr.length * 1000) / 10 : 0 });
  const firstVsRepeat = { first: frStat(rows.filter((x) => x.hc <= 1)), repeat: frStat(rows.filter((x) => x.hc >= 2)) };
  return { total, fundRate, segments, riskCount: risk.length, riskRate: Math.round(risk.length / total * 1000) / 10, scatter, textSignal, firstVsRepeat,
    note: '真实基座：人人贷 P2P（Harvard Dataverse, CC0, 中国大陆）；放款成功/金额/额度/征信/文案为真实列，信用画像为规则派生分层。标的=放款成功，非违约——不可据此推断还款能力。' };
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

/** 真实 RFM 客户分层（案例03 综合闭环专属·v23）：读 2b-real_rfm.csv（UCI 客户级真算）
 *  → 各分层客户数 + 平均 R/F/M；「高价值流失」=会员经营要抢救的群（M高但R大/久未回购）。
 *  这是案例03 区别于案例01 的独有真实底座，也让此前孤立的 2b-real_rfm.csv 真正被消费。 */
export function retailRfm() {
  const t = parseCsv(join(ROOT, 'dataset', 'reference_data_analysis', '2b-real_rfm.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const [rC, fC, mC, sC] = ['最近购买天数', '购买次数', '总消费', '分层(规则派生)'].map(ci);
  const rows = t.rows.map((r) => ({ r: Number(r[rC]) || 0, f: Number(r[fC]) || 0, m: Number(r[mC]) || 0, seg: (r[sC] || '').replace(/[（(]规则[)）]/g, '').trim() }));
  const total = rows.length;
  const order = ['重要价值', '高价值流失', '一般保持', '流失预警', '普通'];
  const segMap: Record<string, { count: number; r: number; f: number; m: number }> = {};
  for (const x of rows) { (segMap[x.seg] ||= { count: 0, r: 0, f: 0, m: 0 }); const s = segMap[x.seg]; s.count++; s.r += x.r; s.f += x.f; s.m += x.m; }
  const segments = order.filter((n) => segMap[n]).map((name) => ({ name, count: segMap[name].count, avgR: Math.round(segMap[name].r / segMap[name].count), avgF: Math.round(segMap[name].f / segMap[name].count), avgM: Math.round(segMap[name].m / segMap[name].count) }));
  const churn = segMap['高价值流失'] || { count: 0 };
  return { total, segments, churnCount: churn.count, churnRate: Math.round((churn.count / total) * 1000) / 10,
    note: '真实基座：UCI Online Retail II 客户级 RFM 真算（R=最近购买天数/F=购买次数/M=总消费）；分层为分位规则派生、非事实标签。「高价值流失」= 消费高但久未回购——正是会员经营要抢救的群。' };
}

/** 运营商客户投诉升级（案例10 专属·v24）：真实锚=工信部《电信服务质量通告》公开聚合（申诉总数/类别占比）；
 *  投诉工单明细为**教学合成**（升级/SLA/优先级按真实类别分布确定性生成，非真实工单）——干净可再分发的大陆运营商明细真集不存在，绝不把合成说成真实。 */
export function telecomComplaints() {
  const t = parseCsv(join(ROOT, 'dataset', 'real', 'miit_telecom_appeals.csv'));
  const ci = (n: string) => t.head.indexOf(n);
  const rows = t.rows.map((r) => ({ quarter: r[ci('季度')], total: Number(r[ci('申诉总件数')]) || 0, svc: Number(r[ci('用户服务类占比')]) || 0, fee: Number(r[ci('收费争议类占比')]) || 0, net: Number(r[ci('网络质量类占比')]) || 0 }));
  const latest = rows.filter((r) => r.svc > 0).slice(-1)[0] || rows[rows.length - 1]; // 取有类别占比的季度（2021Q3）
  const cats = [{ name: '用户服务类', share: latest.svc }, { name: '收费争议类', share: latest.fee }, { name: '网络质量类', share: latest.net }];
  // 合成明细工单（确定性·按真实类别分布分配·标红线）：升级率/SLA 为教学合成，非真实工单
  const N = 200; const escRate: Record<string, number> = { '用户服务类': 18, '收费争议类': 34, '网络质量类': 26 }; // 合成升级率（收费争议最易升级为申诉）
  let acc = 0; const bounds = cats.map((c) => { acc += c.share; return { name: c.name, upto: acc }; });
  const detail = Array.from({ length: N }, (_, i) => { const pos = (i + 0.5) / N * 100; const cat = bounds.find((b) => pos <= b.upto)?.name || cats[0].name;
    const esc = ((i * 37) % 100) < escRate[cat]; const slaH = 8 + ((i * 13) % 40); // 确定性伪随机·无 Math.random
    return { id: i + 1, cat, escalated: esc, slaHours: slaH, priority: esc ? '高' : (slaH > 36 ? '中' : '低') }; });
  const escByCategory = cats.map((c) => { const g = detail.filter((d) => d.cat === c.name); return { name: c.name, share: c.share, count: g.length, escRate: g.length ? Math.round(g.filter((d) => d.escalated).length / g.length * 1000) / 10 : 0 }; });
  const escalatedQueue = detail.filter((d) => d.escalated).sort((a, b) => (a.priority === '高' ? -1 : 1) - (b.priority === '高' ? -1 : 1) || a.slaHours - b.slaHours).slice(0, 8);
  return { real: { quarter: latest.quarter, total: latest.total, cats, trend: rows.map((r) => ({ q: r.quarter, total: r.total })), extortion: 82783, spam: 30742 },
    synthN: N, escByCategory, escalatedCount: detail.filter((d) => d.escalated).length, escalatedQueue,
    note: '真实锚：工信部《电信服务质量通告》公开聚合（申诉总数/类别占比·政府公开信息，2021Q3 全项 + 2020Q2 总数）；**投诉工单明细为教学合成**——升级率/SLA/优先级按真实类别分布确定性生成，非真实工单。干净可再分发的大陆运营商明细真集不存在（JDDC/黑猫/天池 全禁再分发或含 PII），绝不把合成说成真实。' };
}
