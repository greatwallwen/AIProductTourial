#!/usr/bin/env node
/** 读者自测器（v17-C）：把作者护栏转让给读者——核对你照案例做出的方案文档。
 *  用法：node code/tools/check_my_work.mjs <案例号> <你的方案.md>
 *  离线、确定性：查 必含字段 / 指标链 / 异常状态 / Skill 六项引用；红项映射回该重读的章节。 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const [num, file] = process.argv.slice(2);
if (!num || !file) { console.log('用法：node code/tools/check_my_work.mjs <案例号> <你的方案.md>\n示例：node code/tools/check_my_work.mjs 30 我的RFM方案.md'); process.exit(0); }
const defs = JSON.parse(readFileSync(join(ROOT, 'code', 'tools', 'case_definitions.json'), 'utf8'));
const c = defs.cases.find((x) => x.num === Number(num));
if (!c) { console.error(`✗ 案例 ${num} 不存在（现有：${defs.cases.map((x) => x.num).join('/')}）`); process.exit(1); }
let doc; try { doc = readFileSync(file, 'utf8'); } catch { console.error(`✗ 读不到 ${file}`); process.exit(1); }
// 章节映射：红了该回哪读
const CH = { 字段: '案例页「任务目标与数据」+ §1', 指标链: '§1 指标链 + 案例页 KPI', 异常状态: '案例页「异常状态与责任」', Skill: 'skills/pm_skills.md 六槽', 决策动作: '案例页「决策动作」', 风险边界: '§5 交付治理（高影响须人工复核）' };
const checks = [
  ['字段', c.fields.filter((f) => !doc.includes(f)), `方案应引用真实字段（缺：%s）`],
  ['指标链', c.metricChain.filter((m) => !doc.includes(m)), `指标链应逐项出现（缺：%s）`],
  ['异常状态', (c.exceptionStates || []).filter((e) => !doc.includes(e)), `异常状态应有处置（缺：%s）`],
  ['Skill', c.skills.filter((s) => !doc.includes(s)), `应标注所用 Skill（缺：%s）`],
  ['决策动作', doc.includes(c.decisionAction) ? [] : [c.decisionAction], `应落到决策动作「%s」`],
  ['风险边界', c.highImpact && !/人工复核|不得自动/.test(doc) ? ['人工复核声明'] : [], `高影响案例须声明「%s」`],
];
let fail = 0;
console.log(`自测 · 案例 ${num} ${c.slug} · ${file}\n`);
for (const [name, missing, tpl] of checks) {
  if (missing.length) { fail++; console.log(`  ✗ ${name}：${tpl.replace('%s', missing.slice(0, 4).join('、'))}\n     ↳ 回读：${CH[name]}`); }
  else console.log(`  ✔ ${name}`);
}
console.log(fail ? `\n${fail} 项未过——按「回读」指引补齐后再跑一次。` : '\n✅ 全过：你的方案覆盖了本案的可核对要素（内容好坏仍需人判断——这只是确定性下限）。');
process.exit(fail ? 1 : 0);
