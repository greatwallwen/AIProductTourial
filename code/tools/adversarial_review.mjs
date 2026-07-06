#!/usr/bin/env node
/** 对抗式红队评审（self-evolution 的输入）：不是 verify 那种「过/不过」门禁，而是**主动挑刺**——
 *  扫全书 + 仓库，按严重度排出「下一步该修什么」的候选清单，喂给自我进化 Loop（见 skills/loop_engineering/self-evolve.orchestrator.md）。
 *  始终 exit 0（顾问性质，不阻断）。用法：node code/tools/adversarial_review.mjs [--json]  */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const BOOK = 'AI时代研发产品项目一体化知识库';
const rd = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };
const defs = JSON.parse(rd('code/tools/case_definitions.json'));
const walk = (d, ext, out = []) => { try { for (const e of readdirSync(join(ROOT, d))) { const p = join(d, e); if (statSync(join(ROOT, p)).isDirectory()) { if (!['node_modules', 'dist'].includes(e)) walk(p, ext, out); } else if (e.endsWith(ext)) out.push(p); } } catch { /* skip */ } return out; };
const bookFiles = walk(BOOK, '.md');
const tut = bookFiles.map(rd).join('\n');
const F = [];
const add = (sev, cat, file, msg, fix) => F.push({ sev, cat, file, msg, fix });

// ① 数字口径漂移：书里声明的案例/技能数 vs 真实值
{
  const nCase = defs.cases.length;
  const skillN = (rd('skills/pm_skills.md').match(/^## /gm) || []).length;
  for (const f of [...bookFiles, 'README.md', 'README-cn.md']) {
    const s = f.startsWith(BOOK) ? rd(f) : rd(f);
    for (const m of s.matchAll(/(\d+)\s*(个)?\s*(案例|representative|个 Skill|skills \()/g)) {
      const n = +m[1]; const kind = /Skill|skills/.test(m[3]) ? skillN : nCase;
      if (n !== kind && n > 3 && n < 100) add('HIGH', 'stale-count', f, `声明「${m[0].trim()}」与真实值 ${kind} 不符`, `改为 ${kind}（建议用 defs.cases.length 动态化）`);
    }
  }
}
// ② 覆盖漏洞：前端源文件无对应测试（对抗式测试最大缺口）
{
  const src = readdirSync(join(ROOT, 'code', 'web', 'src')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f) && f !== 'main.tsx' && f !== 'vite-env.d.ts');
  for (const f of src) { const base = f.replace(/\.tsx?$/, ''); if (!existsSync(join(ROOT, 'code', 'web', 'src', base + '.test.ts')) && !existsSync(join(ROOT, 'code', 'web', 'src', base + '.test.tsx'))) add('HIGH', 'coverage', `code/web/src/${f}`, '前端组件无单测——回归只能靠人工截图发现', '加 vitest 组件/纯函数测试'); }
  const beAsserts = (rd('code/server/tests/api.test.ts').match(/\bassert/g) || []).length;
  if (beAsserts < defs.cases.length * 2) add('MED', 'coverage', 'code/server/tests/api.test.ts', `后端断言 ${beAsserts} 条，案例 ${defs.cases.length} 个——端点覆盖偏薄`, '每案至少断言其端点/字段各 1');
}
// ③ 内容单薄：案例缺 deepDive 或练习 < 2
for (const c of defs.cases) {
  if (!c.deepDive) add('MED', 'thin-case', `case ${c.num}`, `案例 ${c.num}(${c.slug}) 无 ⭐深度折叠块`, '补 deepDive：权衡/失效模式/何时别用');
  if (!Array.isArray(c.exercises) || c.exercises.length < 2) add('MED', 'thin-case', `case ${c.num}`, `案例 ${c.num} 练习 < 2`, '补练习到 ≥2');
}
// ④ 风格漂移：AI 套话 / emoji 图标混入产物
{
  const slop = tut.match(/赋能|一站式|值得注意的是|综上所述|众所周知|seamless|delve|elevate|pivotal/g);
  if (slop) add('HIGH', 'drift', `${BOOK}/*`, `混入 AI 套话：${[...new Set(slop)].join('、')}`, '去 AI 化改写');
  const emoji = tut.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}★☆]/gu);
  if (emoji) add('HIGH', 'drift', `${BOOK}/*`, `混入 emoji 图标/难度星：${[...new Set(emoji)].slice(0, 6).join(' ')}`, '换专业 SVG 图标 / 文字');
}
// ⑤ 可疑超级词：绝对化措辞附近无数据/引用/章节锚（可能是未验证断言）
for (const f of bookFiles) {
  const s = rd(f);
  for (const m of s.matchAll(/(唯一|所有人都|永不|必然|从不|绝不|最重要的)[^，。！\n]{0,24}/g)) {
    const ctx = s.slice(Math.max(0, m.index - 60), m.index + 60);
    if (!/[0-9]|http|§|来源|案例|dogfood|Spec Kit|作者自报/.test(ctx)) add('LOW', 'claim', f, `绝对化措辞疑无证据：「${m[0].slice(0, 20)}…」`, '补数据/引用，或改弱化措辞');
  }
}
// ⑥ 悬空引用：§7+（本书仅 §1-§6）
{ const bad = [...new Set((tut.match(/§[7-9]\d*/g) || []))]; if (bad.length) add('HIGH', 'dangling-ref', `${BOOK}/*`, `引用不存在的章节：${bad.join('、')}`, '改指正确章节'); }
// ⑦ 巨文件预警：源文件逼近 800 行红线
for (const f of ['code/tools/build_docs.mjs', 'code/tools/verify_course_package.mjs', 'code/web/src/App.tsx', 'code/web/src/screens.tsx', 'code/server/services/cases.ts']) { const n = rd(f).split('\n').length; if (n > 720) add('MED', 'big-file', f, `${n} 行，逼近 800 红线`, '拆分模块'); }

// —— 排序 + 输出 ——
const rank = { HIGH: 0, MED: 1, LOW: 2 };
F.sort((a, b) => rank[a.sev] - rank[b.sev] || a.cat.localeCompare(b.cat));
const counts = F.reduce((o, f) => ((o[f.sev] = (o[f.sev] || 0) + 1), o), {});
if (process.argv.includes('--json')) { writeFileSync(join(ROOT, 'outputs', 'adversarial_review.json'), JSON.stringify({ counts, findings: F }, null, 2)); }
console.log(`\n对抗式红队评审 · ${BOOK}`);
console.log(`发现 ${F.length} 项：HIGH ${counts.HIGH || 0} · MED ${counts.MED || 0} · LOW ${counts.LOW || 0}\n`);
for (const f of F.slice(0, 40)) console.log(`  [${f.sev}] ${f.cat} · ${f.file}\n     ↳ ${f.msg}\n     ↳ 建议：${f.fix}`);
if (F.length > 40) console.log(`  …还有 ${F.length - 40} 项（--json 输出全部）`);
console.log(`\n下一步：把 HIGH 项交给 builder 修 → checker 跑三绿 → 再评审，直到 HIGH 连续两轮清零（见 self-evolve.orchestrator）。`);
