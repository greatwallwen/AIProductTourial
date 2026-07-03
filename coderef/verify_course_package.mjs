#!/usr/bin/env node
/** 全量校验护栏（替代 .ps1）：逐案例核验 数据/预计算/SVG/交付物/截图/Skill/高影响边界，及 manifest 交叉一致。ALL GREEN 才通过。 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..');
const pad = n => String(n).padStart(2, '0');
const rd = p => readFileSync(join(ROOT, p), 'utf8');
const jj = p => JSON.parse(rd(p));
const defs = jj('coderef/case_definitions.json');
const skillsMd = rd('outputs/07_skills/pm_skills.md');
const cat = jj('outputs/product_case_library/real_industry_case_catalog.json');
const blue = jj('outputs/product_case_library/industry_ui_skill_blueprint.json');
let fail = 0, checks = 0;
const bad = (msg) => { fail++; console.log('  ✗ ' + msg); };
const ok = () => { checks++; };
console.log(`验校 ${defs.projectName} · ${defs.cases.length} 案例\n`);
for (const c of defs.cases) {
  const n = pad(c.num); const tag = `[${n} ${c.slug}]`;
  // 数据集
  ok(); if (!existsSync(join(ROOT, c.dataset))) bad(`${tag} 数据集缺失 ${c.dataset}`);
  // 预计算
  const dp = `coderef/react_pm_cases/src/data/case_${n}.json`;
  ok(); if (!existsSync(join(ROOT, dp))) { bad(`${tag} 预计算缺失`); continue; }
  const d = jj(dp);
  ok(); if (!(d.kpis?.length >= 3)) bad(`${tag} 指标链 < 3`);
  ok(); if (!('queue' in d)) bad(`${tag} 无异常队列字段`);
  // SVG
  const svgP = `outputs/product_case_library/svg/case_${n}_${c.slug}.svg`;
  ok(); if (!existsSync(join(ROOT, svgP))) bad(`${tag} SVG 缺失`);
  else { const s = rd(svgP); ok(); if (!/<svg[\s\S]*<\/svg>/.test(s)) bad(`${tag} SVG 非法`); }
  // 交付物 md
  for (const t of ['问题定义', '方案验收']) {
    const mp = `outputs/product_case_library/case_${n}_${c.slug}_${t}.md`;
    ok(); if (!existsSync(join(ROOT, mp))) { bad(`${tag} 交付物缺失 ${t}`); continue; }
    const m = rd(mp);
    ok(); if (!c.skills.every(s => m.includes(s))) bad(`${tag} ${t} 未含全部 Skill`);
  }
  // 截图
  ok(); if (!existsSync(join(ROOT, `assets/screenshots/premium_case_${n}_${c.slug}_desktop.png`))) bad(`${tag} 截图缺失`);
  // Skill 登记
  for (const s of c.skills) { ok(); if (!skillsMd.includes(`## ${s}`)) bad(`${tag} Skill 未登记 ${s}`); }
  // 高影响行业边界
  if (c.highImpact) { ok(); if (!/人工复核/.test(rd(`outputs/product_case_library/case_${n}_${c.slug}_方案验收.md`)) && !/人工复核|不得自动/.test(c.riskBoundary)) bad(`${tag} 高影响行业缺人工复核边界`); }
  // manifest 交叉
  ok(); if (!cat.cases.find(x => x.num === c.num)) bad(`${tag} 不在 catalog`);
  ok(); if (!blue.cases.find(x => x.num === c.num && x.uiId === c.uiId)) bad(`${tag} blueprint uiId 不一致`);
}
// 全局
ok(); if (cat.cases.length !== defs.cases.length) bad(`catalog 数量 ${cat.cases.length} != ${defs.cases.length}`);
ok(); if (!existsSync(join(ROOT, '产品经理转型实操知识库.md'))) bad('主手册缺失');
ok(); if (!existsSync(join(ROOT, 'coderef/react_pm_cases/dist/index.html'))) bad('React 工作台未构建（dist 缺失）');
console.log(`\n检查 ${checks} 项，失败 ${fail} 项`);
if (fail) { console.log('\n✗ NOT GREEN'); process.exit(1); }
console.log('\n✅ ALL GREEN');
