#!/usr/bin/env node
/** 从 case_definitions.json（唯一 source of truth）生成 outputs/product_case_library 下 5 个 manifest。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'outputs', 'product_case_library');
mkdirSync(OUT, { recursive: true });
const defs = JSON.parse(readFileSync(join(ROOT, 'coderef', 'case_definitions.json'), 'utf8'));
const meta = { projectName: defs.projectName, projectNameEn: defs.projectNameEn, caseCount: defs.cases.length };
const w = (name, obj) => writeFileSync(join(OUT, name), JSON.stringify(obj, null, 2));

// 1. 真实行业场景目录
w('real_industry_case_catalog.json', { meta, cases: defs.cases.map(c => ({
  num: c.num, title: c.title, industry: c.industry, role: c.role, scenario: c.scenario,
  dataset: c.dataset, publicRef: c.publicRef, fields: c.fields, metricChain: c.metricChain,
  exceptionStates: c.exceptionStates, decisionAction: c.decisionAction, riskBoundary: c.riskBoundary,
  deliverable: c.deliverable, highImpact: c.highImpact, phase: c.phase })) });

// 2. 行业-UI-Skill 蓝图
w('industry_ui_skill_blueprint.json', { meta, cases: defs.cases.map(c => ({
  num: c.num, title: c.title, uiId: c.uiId, slug: c.slug, uiStrategy: c.uiStrategy,
  saasType: c.saasType, saasLayout: `${c.saasType}｜左侧导航 + 顶部筛选 + 右侧详情抽屉｜${defs.archetypes[c.saasType][0]}`,
  components: c.saasComponents, largeScreenRef: c.largeScreenRef, skills: c.skills, phase: c.phase })) });

// 3. SaaS UI 原型矩阵（13 种）
w('ui_archetype_matrix.json', { meta, archetypes: Object.fromEntries(
  Object.entries(defs.archetypes).map(([k, [density, comps]]) => [k, { density, layout: '左侧导航 + 顶部筛选 + 右侧详情抽屉', components: comps }])) });

// 4. Skill 矩阵（案例→技能 + 技能→案例反查）
const byCase = Object.fromEntries(defs.cases.map(c => [c.num, c.skills]));
const skillIndex = {};
for (const c of defs.cases) for (const s of c.skills) (skillIndex[s] ??= []).push(c.num);
w('case_skill_matrix.json', { meta, caseToSkills: byCase, skillToCases: skillIndex, distinctSkills: Object.keys(skillIndex).sort() });

// 5. 指定实操映射（RP0N→案例）
const rp = {};
for (const c of defs.cases) if (c.rp) rp[c.rp.id] = { case: c.num, title: c.rp.title, produce: c.rp.produce, accept: c.rp.accept };
w('required_practice_mapping.json', { meta, mapping: Object.fromEntries(Object.entries(rp).sort()) });

console.log('生成 5 个 manifest 到', OUT.replace(ROOT + '/', ''));
console.log('cases', defs.cases.length, '| skills', Object.keys(skillIndex).length, '| RPs', Object.keys(rp).length);
