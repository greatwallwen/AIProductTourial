#!/usr/bin/env node
/** 评测回归门 v2（v17-A · 裁判真调被测系统）：金标单源 code/data/eval_gold.json；
 *  主指标 hit@3——期望文档模式必须出现在 store.ts 真实 search() 的重排前 3；次指标 coverage（语料覆盖≥3 篇）。
 *  低于基线 exit 1。用法：node code/tools/eval_harness.mjs [--update|--json]
 *  说明：v1 裁判只量语料静态覆盖——把 search() 改坏门照样绿（此缺陷已写进案例 07 当教学素材）。v2 起裁判必须调被测系统。 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const { VectorStore } = await import('../server/vector/store.ts'); // Node 24 type-stripping：直接 import 被测实现
const CORPUS = join(ROOT, 'skills', 'external', 'pm-skills-deanpeters');
const vs = new VectorStore(); vs.loadDir(CORPUS);
const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p, out); else if (e.endsWith('.md')) out.push(p); } return out; };
const texts = walk(CORPUS).map((f) => readFileSync(f, 'utf8').toLowerCase());
const { gold } = JSON.parse(readFileSync(join(ROOT, 'code', 'data', 'eval_gold.json'), 'utf8'));
const results = gold.map(({ q, kw, docPattern }) => {
  const re = new RegExp(docPattern, 'i');
  const r = vs.search(q, 3, 10); // 被测系统真实调用：召回10→重排3
  const top3 = (r.reranked || []).map((h) => h.id || h.file || h.title || '');
  const hit = top3.some((id) => re.test(String(id)));
  const cov = texts.filter((t) => t.includes(kw)).length;
  return { q, hit, top3: top3.map(String), cov };
});
const hitN = results.filter((r) => r.hit).length;
const score = Math.round(hitN / gold.length * 1000) / 10;
const covOk = results.filter((r) => r.cov >= 3).length;
if (process.argv.includes('--json')) { console.log(JSON.stringify({ score, results }, null, 2)); process.exit(0); }
const bp = join(ROOT, 'code', 'data', 'eval_baseline.json');
if (process.argv.includes('--update')) { writeFileSync(bp, JSON.stringify({ score, judge: 'hit@3(search reranked)', gold: gold.length, coverage: covOk }, null, 2) + '\n'); console.log(`基线已更新 → hit@3=${score}%`); process.exit(0); }
const base = existsSync(bp) ? JSON.parse(readFileSync(bp, 'utf8')).score : 0;
console.log(`eval_harness v2 · 裁判=hit@3(真调 search) · 金标 ${gold.length} 题 · 覆盖达标 ${covOk}/${gold.length}`);
for (const r of results) console.log(`  ${r.hit ? '✔' : '✗'} ${r.q}${r.hit ? '' : `（top3: ${r.top3.map((t) => t.slice(0, 28)).join(' | ')}）`}`);
console.log(`\nhit@3 = ${score}% ｜ 基线 ${base}%`);
if (score < base) { console.error(`✗ 检索质量回归：低于基线 ${base}%——search()/语料被改坏；修复后再提交，或人工确认 --update`); process.exit(1); }
console.log('✅ 通过回归门');
