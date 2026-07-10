#!/usr/bin/env node
/** 读者自测器：解析方案的固定结构，不再用全文关键词存在性冒充学习证据。
 *  用法：node code/tools/check_my_work.mjs <案例号> <你的方案.md> [--json] */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const [num, file] = process.argv.slice(2).filter((arg) => arg !== '--json');
const jsonMode = process.argv.includes('--json');
if (!num || !file) {
  console.log('用法：node code/tools/check_my_work.mjs <案例号> <你的方案.md> [--json]\n示例：node code/tools/check_my_work.mjs 02 我的RFM方案.md');
  process.exit(0);
}
const defs = JSON.parse(readFileSync(join(ROOT, 'code', 'tools', 'case_definitions.json'), 'utf8'));
const courseCase = defs.cases.find((item) => item.num === Number(num));
if (!courseCase) {
  console.error(`✗ 案例 ${num} 不存在（现有：${defs.cases.map((item) => item.num).join('/')}）`);
  process.exit(1);
}
let doc;
try { doc = readFileSync(file, 'utf8'); } catch { console.error(`✗ 读不到 ${file}`); process.exit(1); }

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function section(title) {
  const match = doc.match(new RegExp(`^##\\s+${escapeRe(title)}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\s\\S]))`, 'm'));
  return match?.[1]?.trim() ?? '';
}
function listValue(body, label) {
  const line = body.split(/\r?\n/).find((item) => item.trim().startsWith(`- ${label}：`));
  return line ? line.slice(line.indexOf('：') + 1).split('、').map((item) => item.trim()).filter(Boolean) : [];
}
function missingExact(expected, actual) {
  const values = new Set(actual);
  return expected.filter((item) => !values.has(item));
}

const source = doc.match(/^> 数据来源：`([^`]+)`/m)?.[1] ?? '';
const checklist = section('验收清单');
const conclusion = section('验收结论');
const rejected = section('不合格标准');
const decision = conclusion.match(/^\*\*决策动作\*\*：(.+)$/m)?.[1]?.trim() ?? '';
const actual = {
  fields: listValue(checklist, '必含字段'),
  metrics: listValue(checklist, '必含指标链'),
  exceptions: listValue(checklist, '必含异常状态'),
  skills: listValue(checklist, '必含 Skill')
};
const checks = [
  { name: '结构', missing: ['验收清单', '验收结论', '不合格标准'].filter((title) => !section(title)), reread: '案例页「交付物与验收」', message: '方案必须按固定章节提交' },
  { name: '数据来源', missing: source === courseCase.dataset ? [] : [courseCase.dataset], reread: '案例页「任务目标与数据」', message: '数据来源必须是精确路径' },
  { name: '字段', missing: missingExact(courseCase.fields, actual.fields), reread: '案例页「任务目标与数据」+ §1', message: '验收清单缺真实字段' },
  { name: '指标链', missing: missingExact(courseCase.metricChain, actual.metrics), reread: '§1 指标链 + 案例页 KPI', message: '验收清单缺指标链' },
  { name: '异常状态', missing: missingExact(courseCase.exceptionStates ?? [], actual.exceptions), reread: '案例页「异常状态与责任」', message: '验收清单缺异常状态' },
  { name: 'Skill', missing: missingExact(courseCase.skills, actual.skills), reread: 'skills/pm_skills.md 六槽', message: '验收清单缺所用 Skill' },
  { name: '决策动作', missing: decision === courseCase.decisionAction ? [] : [courseCase.decisionAction], reread: '案例页「决策动作」', message: '验收结论必须给出精确决策动作' },
  { name: '风险边界', missing: rejected.includes(courseCase.riskBoundary) && (!courseCase.highImpact || /人工复核|不得自动/.test(`${rejected}\n${conclusion}`)) ? [] : [courseCase.riskBoundary], reread: '§5 交付治理', message: '不合格标准缺风险边界或人工复核' }
];
const failures = checks.filter((check) => check.missing.length);
const report = {
  schema: 'case-work-check/v2',
  caseId: String(courseCase.num).padStart(2, '0'),
  slug: courseCase.slug,
  file,
  parsed: { source, sections: ['验收清单', '验收结论', '不合格标准'].filter((title) => section(title)), counts: { fields: actual.fields.length, metrics: actual.metrics.length, exceptions: actual.exceptions.length, skills: actual.skills.length } },
  checks: checks.map((check) => ({ name: check.name, ok: check.missing.length === 0, missing: check.missing, reread: check.reread })),
  ok: failures.length === 0
};
if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`自测 · 案例 ${num} ${courseCase.slug} · ${file}\n`);
  for (const check of checks) {
    if (check.missing.length) console.log(`  ✗ ${check.name}：${check.message}（缺：${check.missing.slice(0, 4).join('、')}）\n     ↳ 回读：${check.reread}`);
    else console.log(`  ✔ ${check.name}`);
  }
  console.log(report.ok ? '\n✅ 全过：结构化要素齐全；内容质量仍需独立评审。' : `\n${failures.length} 项未过——关键词堆在正文里不会计入验收清单。`);
}
process.exit(report.ok ? 0 : 1);
