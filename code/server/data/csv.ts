import { readFileSync } from 'node:fs';
/** CSV 解析（数据装载层，纯工具，不含业务）。 */
export interface Table { head: string[]; rows: string[][]; }
function splitLine(l: string): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out;
}
export function parseCsv(path: string): Table {
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  return { head: lines[0].split(',').map((s) => s.replace(/"/g, '')), rows: lines.slice(1).map(splitLine) };
}
