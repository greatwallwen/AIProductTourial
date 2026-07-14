/** v17-B 门禁活体化：/api/gates 真跑 verify + eval_harness，把书自己的发布门禁变成读者可「种错见红」的活展品。
 *  verify 纯 fs 读、秒级；30s 缓存防抖。双口径同屏：断言点（源码 bad( 计数）vs 运行检查项（循环展开）。 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
let cache: { at: number; data: unknown } | null = null;

function runTool(rel: string): { out: string; code: number } {
  try { return { out: execFileSync('node', [rel], { cwd: ROOT, encoding: 'utf8', timeout: 60000 }), code: 0 }; }
  catch (e: unknown) { const err = e as { stdout?: string; status?: number }; return { out: err.stdout || '', code: err.status ?? 1 }; }
}

export function gates() {
  if (cache && Date.now() - cache.at < 30000) return cache.data;
  const v = runTool('code/tools/verify_course_package.mjs');
  const m = v.out.match(/检查 (\d+) 项，失败 (\d+) 项/);
  const checks = m ? Number(m[1]) : 0, failN = m ? Number(m[2]) : -1;
  const badPoints = (readFileSync(join(ROOT, 'code', 'tools', 'verify_course_package.mjs'), 'utf8').match(/bad\(/g) || []).length;
  const fails = [...v.out.matchAll(/^ {2}✗ (.+)$/gm)].map((x) => x[1]).slice(0, 20); // 种错时读者在此看到红在哪
  const ev = runTool('code/tools/eval_harness.mjs');
  const em = ev.out.match(/hit@1 = ([\d.]+)% ｜ 基线 ([\d.]+)%/);
  const data = {
    green: v.code === 0 && ev.code === 0,
    verify: { checks, fail: failN, badPoints, fails, note: '断言点=源码 bad( 计数；运行检查项=循环展开后的实际执行数——两个口径都真' },
    evalGate: { score: em ? Number(em[1]) : null, baseline: em ? Number(em[2]) : null, pass: ev.code === 0, judge: 'hit@1（裁判真调 search()·重排第1）' },
    ranAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}
