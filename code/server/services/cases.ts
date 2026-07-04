import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../data/csv.ts';
/** 业务层：读 case_definitions + 实时读数据集 CSV 计算案例视图（不碰 HTTP 上下文）。 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
const defs = JSON.parse(readFileSync(join(ROOT, 'coderef', 'case_definitions.json'), 'utf8'));

export function listCases() {
  return defs.cases.map((c: any) => ({ num: c.num, title: c.title, industry: c.industry, phase: c.phase, design: c.design, uiId: c.uiId, saasType: c.saasType, graphicOnly: !!c.graphicOnly, demonstrates: c.demonstrates }));
}

export function caseData(num: number) {
  const c = defs.cases.find((x: any) => x.num === num);
  if (!c) return null;
  let rowCount = 0, exceptionCount = 0, queue: any[] = [];
  if (c.dataset.endsWith('.csv')) {
    const t = parseCsv(join(ROOT, c.dataset));
    rowCount = t.rows.length;
    const abIdx = t.head.findIndex((h) => /异常|风险|status|状态|复核/.test(h));
    const exRows = abIdx >= 0 ? t.rows.filter((r) => { const v = (r[abIdx] || '').trim(); return v && !/正常|免复核|否|已完成|低/.test(v); }) : [];
    exceptionCount = exRows.length;
    queue = exRows.slice(0, 8).map((r, i) => ({ id: i + 1, state: c.exceptionStates[i % Math.max(1, c.exceptionStates.length)] || '待处理', fields: Object.fromEntries(c.fields.slice(0, 4).map((f: string) => [f, r[t.head.indexOf(f)] ?? ''])) }));
  }
  const kpis = c.metricChain.map((m: string) => ({
    name: m,
    value: /率|占比/.test(m) ? Math.round((exceptionCount / Math.max(1, rowCount)) * 100) : (/异常.*数|异常数/.test(m) ? exceptionCount : rowCount),
    unit: /率|占比/.test(m) ? '%' : '',
  }));
  return { num: c.num, title: c.title, industry: c.industry, design: c.design, uiId: c.uiId, saasType: c.saasType, dataset: c.dataset, graphicOnly: !!c.graphicOnly, rowCount, exceptionCount, kpis, queue, metricChain: c.metricChain, fields: c.fields, demonstrates: c.demonstrates, riskBoundary: c.riskBoundary, highImpact: c.highImpact };
}
