import { readFileSync } from 'node:fs';
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
    const abIdx = t.head.findIndex((h) => /异常|风险|status|状态|复核/.test(h));
    vm.exceptionCount = abIdx >= 0
      ? t.rows.filter((r) => { const v = (r[abIdx] || '').trim(); return v && !/正常|免复核|否|已完成|低/.test(v); }).length
      : (vm.exceptionCount || 0);
    vm.liveComputed = true;
  }
  vm.graphicOnly = !!c.graphicOnly;
  vm.screen = c.screen || null; // 特殊案例屏：rag/db/arch/3d
  vm.demonstrates = c.demonstrates;
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
