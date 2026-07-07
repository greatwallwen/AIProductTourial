#!/usr/bin/env node
/** 评测回归门（案例 49 · A+ ④）：金标 12 题 × 语料覆盖裁判（离线启发式，规则=「≥3 篇含关键词」），
 *  分数与 code/data/eval_baseline.json 基线比较——低于基线 exit 1（回归拦截）。
 *  用法：node code/tools/eval_harness.mjs [--update 把当前分写为新基线] */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p, out); else if (e.endsWith('.md')) out.push(p); } return out; };
// 金标集（与 build_case_data 案例 49 同源；改题=改两处并跑 --update 立新基线）
const GOLD = [['需求优先级怎么排', 'priorit'], ['RICE 打分模型', 'rice'], ['用户访谈方法', 'interview'], ['产品路线图', 'roadmap'], ['A/B 实验', 'experiment'], ['北极星指标', 'metric'], ['竞品分析', 'compet'], ['MVP 最小可行', 'mvp'], ['留存 cohort 分析', 'cohort'], ['服务蓝图', 'blueprint'], ['定价 van westendorp', 'westendorp'], ['技术债量化', 'tech debt']];
const TH = 3; // 裁判规则：≥3 篇语料含关键词 = 命中（覆盖深度达标，而非「碰得到」）
const corpus = walk(join(ROOT, 'skills', 'external', 'pm-skills-deanpeters')).map((f) => readFileSync(f, 'utf8').toLowerCase());
const results = GOLD.map(([q, kw]) => { const cov = corpus.filter((t) => t.includes(kw)).length; return { q, kw, cov, hit: cov >= TH }; });
const score = Math.round(results.filter((r) => r.hit).length / GOLD.length * 1000) / 10;
const bp = join(ROOT, 'code', 'data', 'eval_baseline.json');
if (process.argv.includes('--update')) { writeFileSync(bp, JSON.stringify({ score, gold: GOLD.length, judge: `coverage>=${TH}`, updated: '手动确认' }, null, 2) + '\n'); console.log(`基线已更新 → ${score}%`); process.exit(0); }
const base = existsSync(bp) ? JSON.parse(readFileSync(bp, 'utf8')).score : 0;
console.log(`eval_harness · 金标 ${GOLD.length} 题 · 裁判=语料覆盖≥${TH} 篇`);
for (const r of results) console.log(`  ${r.hit ? '✔' : '✗'} ${r.q}（${r.cov} 篇）`);
console.log(`\n得分 ${score}% ｜ 基线 ${base}%`);
if (score < base) { console.error(`✗ 回归：低于基线 ${base}%（语料或金标被改坏）——修复后再提交，或人工确认后 --update`); process.exit(1); }
console.log('✅ 通过回归门');
