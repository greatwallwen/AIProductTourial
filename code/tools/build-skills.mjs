#!/usr/bin/env node
/** 由 skill_definitions.json + case_definitions.json 生成结构化可验证 Skill 库 skills/pm_skills.md。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const skills = JSON.parse(readFileSync(join(ROOT,'code', 'tools','skill_definitions.json'),'utf8')).skills;
const defs = JSON.parse(readFileSync(join(ROOT,'code', 'tools','case_definitions.json'),'utf8'));
const usedBy = {}; for (const c of defs.cases) for (const s of c.skills) (usedBy[s]??=[]).push(`${c.num} ${c.scenario}`);
const CHECKERS = new Set(['acceptance-criteria','checker-report','regression-guard','skill-validator','human-review','compliance-boundary','field-validation','eval-design','prototype-test','accessibility-check','acceptance-mapping']);
mkdirSync(join(ROOT,'skills'),{recursive:true});
const out = [`# ${defs.projectName} · Skill 库`,'',
 '每个 Skill 六槽结构化（触发条件/输入/澄清问题/PRD 片段/验收标准/复用范围），可被 `verify_course_package.mjs` 校验。禁止写成不可验证的长文本。','',
 `共 ${Object.keys(skills).length} 个 Skill。`,''];
for (const [id, purpose] of Object.entries(skills)) {
  const kind = CHECKERS.has(id) ? '验收/守护型' : '构建型';
  const cases = usedBy[id]||[];
  out.push(`## ${id}`,'',
   `- 类型：${kind}`,
   `- 触发条件：当需要${purpose}时`,
   `- 输入：案例的数据/资料与字段（仅使用能在数据或资料中找到的字段）`,
   `- 澄清问题：业务对象是谁？指标链如何计算？异常状态怎样追踪？责任与行动如何闭环？`,
   `- PRD 片段：${purpose}，输出结构化交付物并标注数据来源`,
   `- 验收标准：产出可回溯到数据或公开资料，指标链完整、异常可追踪、不越过案例风险边界`,
   `- 复用范围：${cases.length?cases.join('；'):'通用'}`,'');
}
writeFileSync(join(ROOT,'skills','pm_skills.md'), out.join('\n'));
console.log('pm_skills.md:', Object.keys(skills).length, 'skills');
