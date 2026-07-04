import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../data/csv.ts';
/** 业务层：读 case_definitions + 实时读数据集 CSV 计算案例视图（不碰 HTTP 上下文）。 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
const defs = JSON.parse(readFileSync(join(ROOT, 'coderef', 'case_definitions.json'), 'utf8'));

export function listCases() {
  return defs.cases.map((c: any) => ({ num: c.num, title: c.title, industry: c.industry, phase: c.phase, design: c.design, uiId: c.uiId, saasType: c.saasType, graphicOnly: !!c.graphicOnly, demonstrates: c.demonstrates }));
}

/** 案例列表索引（前端侧栏/总览用）：读 build_case_data 的 index.json（真实数据派生）。 */
export function getIndex() {
  return JSON.parse(readFileSync(join(ROOT, 'coderef', 'react_pm_cases', 'src', 'data', 'index.json'), 'utf8'));
}

/** 案例完整视图模型：取真实数据派生的 VM，并实时读 CSV 复算行数/异常数（证明后端真算而非纯静态）。 */
export function caseData(num: number) {
  const c = defs.cases.find((x: any) => x.num === num);
  if (!c) return null;
  const vmPath = join(ROOT, 'coderef', 'react_pm_cases', 'src', 'data', `case_${String(num).padStart(2, '0')}.json`);
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
  vm.demonstrates = c.demonstrates;
  return vm;
}
