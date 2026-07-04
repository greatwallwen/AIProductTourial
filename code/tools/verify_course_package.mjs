#!/usr/bin/env node
/** 全量校验护栏：逐案例 数据/预计算/SVG/交付物/截图/Skill/高影响 + 全局 单一教程/多设计/rules/skills/文件<800行/无工具品牌/design·demonstrates。ALL GREEN 才通过。 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const pad = (n) => String(n).padStart(2, '0');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const jj = (p) => JSON.parse(rd(p));
const has = (p) => existsSync(join(ROOT, p));
const defs = jj('code/tools/case_definitions.json');
const skillsMd = rd('skills/pm_skills.md');
let fail = 0, checks = 0;
const bad = (m) => { fail++; console.log('  ✗ ' + m); };
const ok = () => { checks++; };
console.log(`验校 ${defs.projectName} · ${defs.cases.length} 案例\n`);

// 逐案例
for (const c of defs.cases) {
  const n = pad(c.num), tag = `[${n} ${c.slug}]`;
  ok(); if (!has(c.dataset)) bad(`${tag} 数据集缺失 ${c.dataset}`);
  const dp = `code/data/case_${n}.json`;
  ok(); if (!has(dp)) { bad(`${tag} 预计算缺失`); continue; }
  const d = jj(dp);
  ok(); if (!(d.kpis?.length >= 3)) bad(`${tag} 指标链 < 3`);
  ok(); if (!c.design) bad(`${tag} 无 design`);
  ok(); if (!(c.demonstrates?.length)) bad(`${tag} 无 demonstrates`);
  const svgP = `outputs/product_case_library/svg/case_${n}_${c.slug}.svg`;
  ok(); if (!has(svgP)) bad(`${tag} SVG 缺失`); else { ok(); if (!/<svg[\s\S]*<\/svg>/.test(rd(svgP))) bad(`${tag} SVG 非法`); }
  for (const t of ['问题定义', '方案验收']) {
    const mp = `outputs/product_case_library/case_${n}_${c.slug}_${t}.md`;
    ok(); if (!has(mp)) { bad(`${tag} 交付物缺 ${t}`); continue; }
    ok(); if (!c.skills.every((s) => rd(mp).includes(s))) bad(`${tag} ${t} 未含全部 Skill`);
  }
  ok(); if (!has(`assets/screenshots/premium_case_${n}_${c.slug}_desktop.png`)) bad(`${tag} 截图缺失`);
  for (const s of c.skills) { ok(); if (!skillsMd.includes(`## ${s}`)) bad(`${tag} Skill 未登记 ${s}`); }
  if (c.highImpact) { ok(); if (!/人工复核|不得自动/.test(c.riskBoundary + rd(`outputs/product_case_library/case_${n}_${c.slug}_问题定义.md`))) bad(`${tag} 高影响行业缺人工复核边界`); }
}

// 全局：单一教程结构
const tut = rd('产品经理转型实操知识库.md');
for (const m of ['# 第一部分', '# 第二部分', '## 1. AI 核心概念底层', '## 2. 理念', '## 3. 系统架构', '## 4. 工程规范', '## 5. 设计系统']) { ok(); if (!tut.includes(m)) bad(`教程缺章节「${m}」`); }
ok(); if (readdirSync(ROOT).filter((f) => f.endsWith('.md') && /教程|手册|知识库/.test(f)).length !== 1) bad('教程 md 不唯一');

// 全局：多套设计（≥5 且配色相异）
const themes = jj('design/themes.json').themes;
ok(); if (themes.length < 5) bad('design 少于 5 套');
ok(); if (new Set(themes.map((t) => t.t.accent)).size < 5) bad('design 配色不够相异');
for (const f of themes.map((t) => t.id)) { ok(); if (!has(`design/${f}.md`)) bad(`缺 design/${f}.md`); }

// 全局：rules / skills 工件
for (const f of ['ai-dev-constraints', 'frontend', 'backend', 'references']) { ok(); if (!has(`rules/${f}.md`)) bad(`缺 rules/${f}.md`); }
for (const f of ['builder.role', 'checker.role', 'loop.orchestrator', 'stop-rules', 'memory-template']) { ok(); if (!has(`skills/loop_engineering/${f}.md`)) bad(`缺 skills/loop_engineering/${f}.md`); }
ok(); if (!/只读/.test(rd('skills/loop_engineering/checker.role.md'))) bad('checker 未声明只读');

// 全局：源码单文件 < 800 行
const walk = (dir) => { const out = []; for (const e of readdirSync(join(ROOT, dir))) { const p = join(dir, e); if (statSync(join(ROOT, p)).isDirectory()) { if (!['node_modules', 'dist', 'data'].includes(e)) out.push(...walk(p)); } else if (['.mjs', '.ts', '.tsx', '.css'].includes(extname(e))) out.push(p); } return out; };
for (const f of walk('code/tools')) { const ln = rd(f).split('\n').length; ok(); if (ln > 800) bad(`${f} ${ln} 行 > 800`); }

// 全局：无具体编程工具品牌特写（Loop 工具无关）
for (const f of ['产品经理转型实操知识库.md', 'skills/loop_engineering/README.md', 'skills/loop_engineering/loop.orchestrator.md', 'rules/ai-dev-constraints.md']) {
  ok(); if (/Claude Code|\.claude\b|Cursor\b/.test(rd(f))) bad(`${f} 含具体工具品牌特写`);
}

// 全局：真后端 code/server 存在且各文件 <800 行
for (const f of ['app.ts', 'routes/api.ts', 'services/cases.ts', 'data/csv.ts', 'db/relational.ts', 'vector/store.ts', 'tests/api.test.ts'].map((x) => 'code/server/' + x)) {
  ok(); if (!has(f)) { bad('缺后端文件 ' + f); continue; }
  ok(); if (rd(f).split('\n').length > 800) bad(`${f} > 800 行`);
}
ok(); if (!/fastify/.test(rd('code/server/package.json'))) bad('后端未依赖 fastify');
// 案例02 graphicOnly + 本地公开参考 + deanpeters 本地化
const c02 = defs.cases.find((c) => c.num === 2);
ok(); if (!c02.graphicOnly) bad('案例02 未标 graphicOnly（应只出图形无字段）');
ok(); if (!/skills\/external/.test(c02.publicRef || '')) bad('案例02 未引本地参考');
ok(); if (!has('skills/external/pm-skills-deanpeters/README.md')) bad('deanpeters 未本地化到 skills/external');
// 全局：前端 live fetch + 一服务集成
for (const f of ['code/web/src/App.tsx', 'code/web/src/lib/api.ts', 'code/run.sh']) { ok(); if (!has(f)) bad('缺前端/集成文件 ' + f); }
ok(); if (!/fetchIndex|\/api\//.test(rd('code/web/src/lib/api.ts'))) bad('前端未走后端 API（live fetch）');
ok(); if (!/(webDist|fastifyStatic)/.test(rd('code/server/app.ts'))) bad('后端未托管前端静态包（一服务）');
ok(); if (rd('code/web/src/App.tsx').split('\n').length > 800) bad('code/web/src/App.tsx > 800 行');
// 全局：架构相关新案例（向量库 RAG / PostgreSQL / 系统架构 / three.js 3D）+ 其真实后端能力
for (const [num, screen] of [[44, 'rag'], [45, 'db'], [46, 'arch'], [47, '3d']]) {
  const c = defs.cases.find((x) => x.num === num);
  ok(); if (!c || c.screen !== screen) bad(`案例${num} 缺失或 screen≠${screen}`);
}
const apiSrc = rd('code/server/routes/api.ts');
for (const ep of ['/api/search', '/api/db/query', '/api/points3d']) { ok(); if (!apiSrc.includes(ep)) bad(`后端缺接口 ${ep}`); }
ok(); if (!has('code/web/src/screens.tsx')) bad('前端缺 screens.tsx（架构/向量/PG/3D 案例屏）');
ok(); if (!/@react-three\/fiber/.test(rd('code/web/package.json'))) bad('前端未装 three.js/R3F');
ok(); if (!/PseudoScatter|hasWebGL/.test(rd('code/web/src/screens.tsx'))) bad('3D 无 WebGL 退化(伪 3D)未实现');
// 维度 A/D/E：数字化主线标签 + 术语 + 备注叙事 + tokenize/openapi
for (const c of defs.cases) { ok(); if (!c.systemLayer || !c.systemStage || !c.theoryOp) bad(`案例${c.num} 缺系统主线标签(systemLayer/systemStage/theoryOp)`); }
ok(); if ([...new Set(defs.cases.map((c) => c.systemLayer))].length < 3) bad('systemLayer 分层不足 3（底座/能力/应用）');
ok(); if (/信息化/.test(tut)) bad('教程含「信息化」（应改数字化）');
ok(); if (!has('docs/_source/_ref-annotation-style.md')) bad('缺 issue#4 备注范例存档');
ok(); if (!/黄仁勋|你有没有想过|你问 ChatGPT/.test(rd('docs/_source/00-ai-foundations.md'))) bad('§1 备注未按 issue#4 富叙事重写');
ok(); if (!/tokenize/.test(rd('code/server/routes/api.ts')) || !has('code/server/services/tokenize.ts')) bad('缺 /api/tokenize 后端');
ok(); if (!has('code/server/services/openapi.ts') || !/openapi\.json/.test(rd('code/server/routes/api.ts'))) bad('缺 /api/openapi.json');
ok(); if (!tut.includes('数字化系统全景')) bad('教程缺「数字化系统全景」章');
ok(); if (!has('outputs/product_case_library/svg/fig_system_panorama.svg')) bad('缺系统全景 SVG');
ok(); if ((tut.match(/在数字化系统中的位置/g) || []).length < defs.cases.length) bad('案例未全部标注系统位置');
// 维度 B/C：概念实验室 + 产品化前端
for (const f of ['code/web/src/lab.tsx', 'code/web/src/pages.tsx', 'code/web/src/chart3d.tsx']) { ok(); if (!has(f)) bad('缺前端文件 ' + f); }
const lab = rd('code/web/src/lab.tsx');
for (const k of ['tokenizer', 'context', 'rag', 'agent']) { ok(); if (!lab.includes(k + ':')) bad(`概念实验室缺 ${k} 交互`); }
ok(); if (!/data-theme|useTheme/.test(rd('code/web/src/App.tsx'))) bad('缺亮/暗主题切换');
const pg = rd('code/web/src/pages.tsx');
ok(); if (!/PrincipleIndex/.test(pg)) bad('缺原理索引双向溯源');
ok(); if (!/ApiDocs|openapi/i.test(pg)) bad('缺在线 API 文档页');
ok(); if (!/lazy\(\(\) => import\('\.\/chart3d'\)\)/.test(rd('code/web/src/screens.tsx'))) bad('three.js 未懒加载(代码分割)');
ok(); if (!/focus-visible/.test(rd('code/web/src/index.css'))) bad('缺 a11y 焦点可达样式');
// 维度 E：网络下载真实图形 vendored + 使用 + 来源注明
ok(); if (!has('assets/vendor/lucide/LICENSE')) bad('缺 vendored 真实图形(assets/vendor)');
ok(); if (!/vendor/.test(rd('dataset/MANIFEST.md'))) bad('MANIFEST 未注明 vendored 图形来源/许可');
ok(); if (!/loadIcon/.test(rd('code/tools/build_docs.mjs'))) bad('未用下载的真实图形优化图形');
// 维度 B：aiagent 权威内容 vendored + §1 嵌真图 + RAG 两阶段重排
ok(); if (readdirSync(join(ROOT, 'docs', '_source', 'reference')).filter((f) => f.endsWith('.md')).length < 5) bad('aiagent 参考文档 < 5');
ok(); if (!has('assets/vendor/aiagent') || readdirSync(join(ROOT, 'assets', 'vendor', 'aiagent')).filter((f) => f.endsWith('.png')).length < 10) bad('aiagent 真实原理图 < 10');
ok(); if ((tut.match(/aiagent\/image/g) || []).length < 5) bad('§1 未嵌入 aiagent 真实原理图');
ok(); if (!/reranked/.test(rd('code/server/vector/store.ts')) || !/recall/.test(rd('code/server/vector/store.ts')) || !/reranked/.test(rd('code/server/routes/api.ts'))) bad('RAG 未实现召回→重排两阶段');
// 维度 C：数据真实化 — metricSpec 真算 + KPI 值域/非退化守卫
let specCases = 0;
for (const c of defs.cases) {
  if (!Array.isArray(c.metricSpec)) continue; specCases++;
  const dp = `code/data/case_${pad(c.num)}.json`; if (!has(dp)) continue;
  const kp = jj(dp).kpis || [];
  ok(); if (kp.length !== c.metricSpec.length) bad(`案例${c.num} KPI 数与 metricSpec 不符`);
  for (const k of kp) {
    ok(); if (k.unit === '%' && (k.value < 0 || k.value > 100)) bad(`案例${c.num} 率值越界 ${k.name}=${k.value}`);
    ok(); if (!Number.isFinite(k.value)) bad(`案例${c.num} KPI 非数 ${k.name}`);
  }
  ok(); if (kp.length > 1 && new Set(kp.map((k) => k.value)).size === 1) bad(`案例${c.num} KPI 全同(退化/未真算)`);
}
ok(); if (specCases < 15) bad('metricSpec 覆盖案例过少（数据真实化不足）');
// 维度 D：去模板 + 可读性（难度/一句话/洞见/坑 + 术语表）
for (const c of defs.cases) { ok(); if (!c.difficulty || !c.tldr || !c.insight || !c.pitfall) bad(`案例${c.num} 缺 difficulty/tldr/insight/pitfall`); }
ok(); if (!tut.includes('术语表')) bad('教程缺术语表');
ok(); if (!tut.includes('🎯 **一句话**')) bad('案例未标一句话/难度');
ok(); if (!/data-theme|useTheme/.test(rd('code/web/src/App.tsx'))) bad('主题切换缺失');
// 维度 D：趣味互动（案例内决策题 + 休闲游戏 + 学习进度成就）
for (const f of ['challenge.tsx', 'game.tsx', 'progress.ts']) { ok(); if (!has('code/web/src/' + f)) bad('缺趣味互动 code/web/src/' + f); }
ok(); if (!/GamePage/.test(rd('code/web/src/App.tsx')) || !/\/game/.test(rd('code/web/src/App.tsx'))) bad('缺休闲小游戏路由');
ok(); if (!/Challenge/.test(rd('code/web/src/App.tsx'))) bad('案例内未接入决策题挑战');
ok(); if (!/getProgress/.test(rd('code/web/src/pages.tsx')) || !/markViewed/.test(rd('code/web/src/App.tsx'))) bad('缺学习进度/成就');
// 维度 E：前端 vitest 测试
ok(); if (!has('code/web/src/progress.test.ts')) bad('缺前端 vitest 测试');
ok(); if (!/vitest/.test(rd('code/web/package.json'))) bad('未装 vitest');

console.log(`\n检查 ${checks} 项，失败 ${fail} 项`);
if (fail) { console.log('\n✗ NOT GREEN'); process.exit(1); }
console.log('\n✅ ALL GREEN');
