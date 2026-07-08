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
    for (const m of s.matchAll(/(\d+)\s*个?\s*(真实案例|案例|representative|个 [Ss]kill|结构化 [Ss]kill|skills \()/g)) {
      const n = +m[1]; const kind = /[Ss]kill/.test(m[2]) ? skillN : nCase;
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
  const slop = tut.match(/赋能|一站式|值得注意的是|综上所述|众所周知|保驾护航|添砖加瓦|一揽子|强强联合|seamless|delve|elevate|pivotal|leverage|synergy|holistic|robust\b/g);
  if (slop) add('HIGH', 'drift', `${BOOK}/*`, `混入 AI 套话：${[...new Set(slop)].join('、')}`, '去 AI 化改写');
  const emoji = tut.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}★☆]/gu);
  if (emoji) add('HIGH', 'drift', `${BOOK}/*`, `混入 emoji 图标/难度星：${[...new Set(emoji)].slice(0, 6).join(' ')}`, '换专业 SVG 图标 / 文字');
}
// ⑤ 可疑超级词：绝对化措辞附近无数据/引用/章节锚（可能是未验证断言）
for (const f of bookFiles) {
  const s = rd(f);
  for (const m of s.matchAll(/(唯一|所有人都|永不|必然|从不|绝不|最重要的)[^，。！\n]{0,24}/g)) {
    const ctx = s.slice(Math.max(0, m.index - 60), m.index + 60);
    // 白名单：附近有数据/链接/章节锚/来源，或有具名署名·证据·具名生成物（休谟/Pearl 引文、OpenAPI 自动生成、OpenSpec、GitHub 密钥惨案等真实佐证）
    if (!/[0-9]|http|§|来源|案例|dogfood|Spec Kit|作者自报|休谟|Pearl|OpenAPI|OpenSpec|自动生成|密钥|GitHub|契约即代码/.test(ctx)) add('LOW', 'claim', f, `绝对化措辞疑无证据：「${m[0].slice(0, 20)}…」`, '补数据/引用，或改弱化措辞');
  }
}
// ⑥ 悬空引用：§7+（本书正文 §1-§10 + 附录A/B）
{ const bad = [...new Set((tut.match(/§(?:1[1-9]|[2-9]\d)(?!\.)/g) || []))]; if (bad.length) add('HIGH', 'dangling-ref', `${BOOK}/*`, `引用不存在的章节（本书 §1-§10+附录）：${bad.join('、')}`, '改指正确章节'); }
// ⑦ 巨文件预警：源文件逼近 800 行红线
for (const f of ['code/tools/build_docs.mjs', 'code/tools/verify_course_package.mjs', 'code/web/src/App.tsx', 'code/web/src/screens.tsx', 'code/server/services/cases.ts']) { const n = rd(f).split('\n').length; if (n > 720) add('MED', 'big-file', f, `${n} 行，逼近 800 红线`, '拆分模块'); }

// ⑧ 用户维度：章节丰富度 + 前后联系 + 趣味/游戏 + caseCount 元数据漂移 + 未用素材
{
  if (defs.caseCount && defs.caseCount !== defs.cases.length) add('HIGH', 'stale-count', 'case_definitions.json', `caseCount=${defs.caseCount} 与真实案例数 ${defs.cases.length} 不符`, `改为 ${defs.cases.length} 或删该冗余字段`);
  // v16 拆棘轮：地板改「最低可用」（不再向最厚章看齐、不再逼加码）；fun/unused 等催加码探针已删
  for (const f of bookFiles.filter((p) => /\/(0[0-9]|10)-|\/99-/.test(p) && !p.includes('案例'))) {
    const s = rd(f), nm = f.split('/').pop();
    const notes = (s.match(/```备注/g) || []).length, figs = (s.match(/!\[/g) || []).length, xref = (s.match(/§[0-9]|案例 ?[0-9]/g) || []).length;
    if (figs < 1) add('LOW', 'richness', f, `${nm} 全章无图`, '若确有助理解可补 1 张，否则忽略');
    if (notes < 2 && !/99-/.test(f)) add('LOW', 'richness', f, `${nm} 科普备注 < 2`, '仅当章节确实难懂时补');
    if (xref < 2) add('LOW', 'cross-link', f, `${nm} 交叉引用 < 2`, '仅补真正相关的引用');
  }
}

// ⑨ 反思清单维度（v14）：onboarding 新手摩擦 / diataxis 模式分离 / freshness 工具过时 / coverage 后端断言
{
  const beAsserts = (rd('code/server/tests/api.test.ts').match(/\bassert/g) || []).length;
  if (beAsserts < defs.cases.length * 2) add('MED', 'coverage', 'code/server/tests/api.test.ts', `后端断言 ${beAsserts} < 2×案例 ${defs.cases.length}`, '每 /api/* 端点 ≥2 契约断言');
  for (const f of bookFiles.filter((p) => /\/(0[0-9]|10)-/.test(p) && !p.includes('案例'))) {
    const s = rd(f), nm = f.split('/').pop();
    if (!/前置/.test(s)) add('MED', 'onboarding', f, `${nm} 无「前置」声明`, '章首加前置');
    if (!/读完你能|本章学习目标/.test(s)) add('MED', 'onboarding', f, `${nm} 无「读完你能」学习目标`, '章首加学习目标');
  }
  if (!existsSync(join(ROOT, 'outputs', 'onboarding_audit.md'))) add('HIGH', 'onboarding', 'outputs/onboarding_audit.md', '未做新手摩擦审计（零基础读者走查）', '跑审计→记录→修复→标已修复');
  else if (/\[待修\]|未修复 HIGH/.test(rd('outputs/onboarding_audit.md'))) add('HIGH', 'onboarding', 'outputs/onboarding_audit.md', '新手摩擦审计仍有未修复 HIGH', '修完再标');
  if (/星数|Nacos 3\.2|ralph run|nacos-cli|garrytan|obra\/superpowers/.test(tut) && !/最后核实|核实日期|截至 202/.test(tut)) add('MED', 'freshness', `${BOOK}/*`, '工具/版本/星数内容无「最后核实」日期——易过时', '工具节加「最后核实：YYYY-MM」约定');
}

// （原 ⑩ codebuddy 维为「内容必须存在」型钉死，v16 拆棘轮已删——内容取舍交给 verify 的内容快照 diff）

// ⑪ v-精简：冗余重复 + 套路化开头（补 slop 词表没覆盖的「重复」类 AI 味；扫源 docs/_source + build_docs README 字面量，不扫构建产物，否则每章会被误判为其源的重复）
{
  const srcDir = 'docs/_source';
  const units = [];
  try { for (const f of readdirSync(join(ROOT, srcDir)).filter((f) => f.endsWith('.md') && !f.startsWith('_'))) units.push([srcDir + '/' + f, rd(srcDir + '/' + f)]); } catch { /* skip */ }
  const bd = rd('code/tools/build_docs.mjs');
  const lits = (bd.match(/'[^']{40,}'/g) || []).filter((s) => /[一-鿿]/.test(s)).join('\n');
  units.push(['build_docs.mjs(README 模板)', lits]);
  // (a) 近重复：30 字归一化 shingle 出现在 ≥2 源单元 = 疑似跨文件重复（先剥图片/链接/代码/URL，只比散文，否则资源路径会误报）
  const stripMd = (s) => s.replace(/```[\s\S]*?```/g, '').replace(/!?\[[^\]]*\]\([^)]*\)/g, '').replace(/`[^`]*`/g, '').replace(/https?:\/\/\S+/g, '');
  const norm = (s) => stripMd(s).replace(/[\s\p{P}\p{S}A-Za-z0-9]/gu, '');
  const shingle = new Map();
  for (const [name, text] of units) { const n = norm(text); for (let i = 0; i + 24 <= n.length; i += 6) { const sh = n.slice(i, i + 24); if (!shingle.has(sh)) shingle.set(sh, new Set()); shingle.get(sh).add(name); } }
  const seen = new Set(); let dupN = 0;
  for (const [sh, set] of shingle) { if (set.size >= 2 && dupN < 10) { const key = sh.slice(0, 14); if (!seen.has(key)) { seen.add(key); dupN++; add('MED', 'redundancy', [...set].join(' ↔ '), `疑似跨文件重复：「${sh.slice(0, 22)}…」`, '留一处、其余改回指'); } } }
  // (b) 套路化开头：同一钩子短语 > 2 次
  const allSrc = units.map((u) => u[1]).join('\n');
  for (const h of ['你有没有想过', '你有没有发现', '你有没有经历过', '你有没有接手过', '想象一下', '不妨想想']) { const c = (allSrc.match(new RegExp(h, 'g')) || []).length; if (c > 2) add('MED', 'redundancy', srcDir, `套路化开头「${h}」出现 ${c} 次（>2）`, '留 1-2 处、其余改直陈/换说法'); }
}

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
