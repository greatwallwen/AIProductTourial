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
  ok(); if (![48, 49, 50].includes(c.num) && !has(c.dataset)) bad(`${tag} 数据集缺失 ${c.dataset}`); // 48/49/50 为多源 dogfood（tests/verify/语料），无单一数据文件，效应真实性由下方专项守卫核验
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

// 全局：多文件教程结构（v11：单 md 已拆为目录，改用「目录完整性」等强度守卫）
const BOOK = 'AI时代研发产品项目一体化知识库';
const bookFiles = [];
(function walkBook(d) { for (const e of readdirSync(join(ROOT, d))) { const p = join(d, e); if (statSync(join(ROOT, p)).isDirectory()) walkBook(p); else if (e.endsWith('.md')) bookFiles.push(p); } })(BOOK);
const tut = bookFiles.map((f) => rd(f)).join('\n');           // 全书拼接，供内容守卫扫描
for (const m of ['## 1. AI 核心概念底层', '## 2. 理念', '## 3. 系统架构', '## 4. 工程规范', '## 5. 设计系统', '## 6. 交付治理']) { ok(); if (!tut.includes(m)) bad(`教程缺章节「${m}」`); }
// 目录完整性：根无单 md 孤儿 + 章/README/术语/结课/案例齐 + 每文件<800行 + README 链接不断链
ok(); if (readdirSync(ROOT).filter((f) => f.endsWith('.md') && /教程|手册|知识库/.test(f)).length !== 0) bad('根目录仍有单一教程 md（应已拆为目录）');
for (const f of ['README.md', '01-AI核心概念底层.md', '02-会Loop的工程.md', '03-系统架构设计.md', '04-工程规范与约束.md', '05-设计系统.md', '06-交付治理.md', '术语表.md', '99-结课.md', '案例/README.md']) { ok(); if (!has(`${BOOK}/${f}`)) bad(`教程缺文件 ${BOOK}/${f}`); }
for (const c of defs.cases) { ok(); if (!has(`${BOOK}/案例/${pad(c.num)}-${c.slug}.md`)) bad(`缺案例文件 ${pad(c.num)}-${c.slug}.md`); }
for (const f of bookFiles) { ok(); if (rd(f).split('\n').length > 800) bad(`${f} > 800 行`); }
{ const rm = rd(`${BOOK}/README.md`); for (const l of [...rm.matchAll(/\]\(([^)#][^)]*\.md)\)/g)].map((m) => m[1]).filter((l) => !l.startsWith('../'))) { ok(); if (!has(`${BOOK}/${l}`)) bad(`README 目录链接断链：${l}`); } }

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

// 全局：无具体编程工具品牌特写（Loop 工具无关；教程正文 + skills/rules）
ok(); if (/Claude Code|\.claude\b|Cursor\b|Everything Claude Code|affaan-m\/ECC/.test(tut)) bad('教程含具体工具品牌特写');
for (const f of ['skills/loop_engineering/README.md', 'skills/loop_engineering/loop.orchestrator.md', 'rules/ai-dev-constraints.md']) {
  ok(); if (/Claude Code|\.claude\b|Cursor\b/.test(rd(f))) bad(`${f} 含具体工具品牌特写`);
}

// 全局：真后端 code/server 存在且各文件 <800 行
for (const f of ['app.ts', 'routes/api.ts', 'services/cases.ts', 'data/csv.ts', 'db/relational.ts', 'vector/store.ts', 'tests/api.test.ts'].map((x) => 'code/server/' + x)) {
  ok(); if (!has(f)) { bad('缺后端文件 ' + f); continue; }
  ok(); if (rd(f).split('\n').length > 800) bad(`${f} > 800 行`);
}
ok(); if (!/fastify/.test(rd('code/server/package.json'))) bad('后端未依赖 fastify');
// deanpeters 本地化（RAG 语料，案例 44）
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
ok(); if (specCases < 6) bad('metricSpec 覆盖案例过少（数据真实化不足）');
// 维度 D：去模板 + 可读性（难度/一句话/洞见/坑 + 术语表）
for (const c of defs.cases) { ok(); if (!c.difficulty || !c.tldr || !c.insight || !c.pitfall) bad(`案例${c.num} 缺 difficulty/tldr/insight/pitfall`); }
ok(); if (!tut.includes('术语表')) bad('教程缺术语表');
ok(); if (/别只做「/.test(tut)) bad('案例 insight 仍为模板（别只做…），需真内容');
ok(); if (!tut.includes('**一句话**')) bad('案例未标一句话/难度');
ok(); if (!/data-theme|useTheme/.test(rd('code/web/src/App.tsx'))) bad('主题切换缺失');
// 维度 D：趣味互动（案例内决策题 + 休闲游戏 + 学习进度成就）
for (const f of ['challenge.tsx', 'game.tsx', 'progress.ts']) { ok(); if (!has('code/web/src/' + f)) bad('缺趣味互动 code/web/src/' + f); }
ok(); if (!/GamePage/.test(rd('code/web/src/App.tsx')) || !/\/game/.test(rd('code/web/src/App.tsx'))) bad('缺休闲小游戏路由');
ok(); if (!/Challenge/.test(rd('code/web/src/App.tsx'))) bad('案例内未接入决策题挑战');
ok(); if (!/getProgress/.test(rd('code/web/src/pages.tsx')) || !/markViewed/.test(rd('code/web/src/App.tsx'))) bad('缺学习进度/成就');
// 维度 E：前端 vitest 测试
ok(); if (!has('code/web/src/progress.test.ts')) bad('缺前端 vitest 测试');
ok(); if (!/vitest/.test(rd('code/web/package.json'))) bad('未装 vitest');
// P0 诚信守卫（v7）：无 undefined / 无硬编码 PASS / 队列 owner 不伪造 / Challenge 不引用伪造 owner
ok(); if (/（undefined）/.test(tut)) bad('教程含（undefined）占位');
for (const c of defs.cases) {
  const dp = `outputs/product_case_library/case_${pad(c.num)}_${c.slug}_问题定义.md`;
  const mp = `outputs/product_case_library/case_${pad(c.num)}_${c.slug}_方案验收.md`;
  ok(); if (has(dp) && /（undefined）/.test(rd(dp))) bad(`案例${c.num} 问题定义含（undefined）`);
  ok(); if (has(mp) && /PASS — 指标链 \d+ 项、异常队列/.test(rd(mp))) bad(`案例${c.num} 方案验收硬编码 PASS`);
}
ok(); if (/owner:\s*rec\[.*pickOwner|const owner\b[^\n]*pickOwner/.test(rd('code/tools/build_case_data.mjs'))) bad('队列 owner 仍哈希伪造（应取真实责任列）');
// P2 深度标杆：案例30 航空 RFM 专属 demo + 设计过的数据集（带 design.md）
ok(); if (!has('dataset/design/case_30.md')) bad('案例30 缺数据集设计说明 dataset/design/case_30.md');
// 逐案数据集设计说明（CSV 业务案例须有 dataset/design/case_NN.md）
for (const c of defs.cases) {
  if (!c.dataset.endsWith('.csv') || (c.screen && c.num !== 30)) continue;
  ok(); if (!has(`dataset/design/case_${pad(c.num)}.md`)) bad(`案例${c.num} 缺数据集设计说明 dataset/design/case_${pad(c.num)}.md`);
}
ok(); if (defs.cases.find((c) => c.num === 30)?.screen !== 'rfm') bad('案例30 未接专属 RFM demo（screen≠rfm）');
ok(); if (!/api\/rfm/.test(rd('code/server/routes/api.ts')) || !/RfmScreen/.test(rd('code/web/src/screens.tsx'))) bad('缺 RFM 后端/前端');
// 专属 demo：案例16 医院容量
ok(); if (defs.cases.filter((c) => c.screen).length < defs.cases.length) bad('存在非专属 demo 案例（应 11/11 有 screen）');
ok(); if (defs.cases.find((c) => c.num === 14)?.screen !== 'dispatch' || !/api\/dispatch/.test(rd('code/server/routes/api.ts')) || !/DispatchScreen/.test(rd('code/web/src/screens.tsx'))) bad('案例14 物流派单专属 demo 缺失');
ok(); if (defs.cases.find((c) => c.num === 28)?.screen !== 'riskreview' || !/api\/riskreview/.test(rd('code/server/routes/api.ts')) || !/RiskScreen/.test(rd('code/web/src/screens.tsx'))) bad('案例28 风控复核专属 demo 缺失');
ok(); if (defs.cases.find((c) => c.num === 31)?.screen !== 'adfunnel' || !/api\/adfunnel/.test(rd('code/server/routes/api.ts')) || !/AdFunnelScreen/.test(rd('code/web/src/screens.tsx'))) bad('案例31 广告漏斗专属 demo 缺失');
ok(); if (defs.cases.find((c) => c.num === 16)?.screen !== 'capacity' || !/api\/hospital/.test(rd('code/server/routes/api.ts')) || !/HospitalScreen/.test(rd('code/web/src/screens.tsx'))) bad('案例16 医院容量专属 demo 缺失');
// 图表数据驱动守卫：CSV 案例的图表必须是真实列聚合（有 by 说明），不得哈希噪声
ok(); if (/\(\(seed *>> *i\) *& *63\)|seed *>> *\(i *% *20\)/.test(rd('code/tools/build_case_data.mjs'))) bad('图表仍用 saasType 哈希噪声');
for (const c of defs.cases) {
  if (!c.dataset.endsWith('.csv') || c.screen) continue;
  const dp = `code/data/case_${pad(c.num)}.json`;
  ok(); if (has(dp) && !jj(dp).chart?.by) bad(`案例${c.num} 图表非数据驱动（缺 by 聚合说明）`);
}

// ============ v8：教学法 + 诚信增强守卫 ============
const N = defs.cases.length;
const rdmEn = rd('README.md'), rdmCn = rd('README-cn.md');
// 1) 案例数口径一致：正文/两个 README 不得再现旧口径(25/21)
ok(); if (/25 个?案例|25 案例|21 real industry/.test(tut + rdmCn + rdmEn)) bad(`存在旧案例数口径(25/21)，应统一为 ${N}`);
ok(); if (!new RegExp(`${N} representative`).test(rdmEn)) bad(`README.md 未把案例数标为 ${N}`);
// 2) 禁顺子占位假指标：任何案例 KPI 不得为 (i+2)*11 序列(22/33/44/55)；全案例 KPI 非退化
for (const c of defs.cases) {
  const dp = `code/data/case_${pad(c.num)}.json`; if (!has(dp)) continue;
  const kp = jj(dp).kpis || [];
  ok(); if (kp.length >= 4 && kp.slice(0, 4).every((k, i) => k.value === (i + 2) * 11)) bad(`案例${c.num} KPI 仍是顺子占位(22/33/44/55)`);
  ok(); if (kp.length > 1 && new Set(kp.map((k) => k.value)).size === 1) bad(`案例${c.num} KPI 全同(退化/未真算)`);
}
// 44/46 关键真实值下限（防回退占位）
ok(); if (((jj('code/data/case_44.json').kpis || [])[0]?.value || 0) < 100) bad('案例44 语料篇数应为真实统计(≥100)，疑似占位');
ok(); if (((jj('code/data/case_46.json').kpis || []).find((k) => k.name === '接口数')?.value || 0) < 5) bad('案例46 接口数应为真实统计(≥5)，疑似占位');
// 3) 跨行业词泄漏 + 决策动作去重
ok(); if (/薪酬|招聘|编制超配/.test(tut)) bad('教程含跨行业错配词(HR 词泄漏到非人力案例)');
const _das = defs.cases.map((c) => c.decisionAction);
ok(); if (new Set(_das).size !== _das.length) bad('案例 decisionAction 存在雷同(应各案例专属)');
// 4) 教学支架：每理论章须有 学习目标/小结/练习
for (const f of ['00-ai-foundations', '01-ideology', '02-architecture', '03-engineering', '04-designs']) {
  const s = rd(`docs/_source/${f}.md`);
  ok(); if (!/本章学习目标/.test(s)) bad(`${f} 缺「学习目标」`);
  ok(); if (!/本章小结/.test(s)) bad(`${f} 缺「本章小结」`);
  ok(); if (!/### 练习/.test(s)) bad(`${f} 缺「练习」`);
}
// 正文须有 导读/路线/排查/预期输出 + lab/game 引导 + 三档标记
for (const m of ['## 这本书讲什么', '### 学习路线图', '你应看到', '#/lab/tokenizer', '#/game', '**必读**']) {
  ok(); if (!tut.includes(m)) bad(`教程缺教学支架「${m}」`);
}
// 精简：目录结构/环境/常见报错排查已从教程迁到 README（去冗余），守卫其未丢失
ok(); if (!/常见报错/.test(rdmCn)) bad('README-cn 缺常见报错排查（已从教程迁入）');
ok(); if (!/使用入口/.test(tut) || !/README/.test(tut)) bad('教程「使用入口」未指向 README');
// 每案例须有 跟着做 + 练习(exercises)
ok(); if ((tut.match(/### 跟着做（动手复现）/g) || []).length < N) bad('部分案例缺「跟着做」动手环节');
ok(); if ((tut.match(/### 练习/g) || []).length < N + 5) bad(`练习不足(应 ≥ 5 理论章 + ${N} 案例)`);
for (const c of defs.cases) { ok(); if (!Array.isArray(c.exercises) || c.exercises.length < 2) bad(`案例${c.num} 缺练习(exercises<2)`); }
// 5) README 死链：旧死链不得复现，关键引用须存在
ok(); if (/outputs\/07_skills/.test(rdmEn)) bad('README.md 仍含死链 outputs/07_skills');
ok(); if (rdmEn.includes('skills/pm_skills.md') && !has('skills/pm_skills.md')) bad('README.md 引用 skills/pm_skills.md 不存在');

// ============ v10：真实数据基座 + 埋点 + 诚信增强守卫 ============
// A) 前端案例数不得硬编码（应从 /api 动态取）——旧「25」曾从此泄漏（verify 此前只扫 md/README）
{ const webSrc = walk('code/web/src').filter((f) => /\.(tsx|ts)$/.test(f)).map((f) => rd(f)).join('\n');
  ok(); if (/\d+\s*个?案例|\d+\s*案例串/.test(webSrc)) bad('前端 code/web/src 仍写死案例数（应从 /api 动态取）'); }
// B) MANIFEST 死链守卫（此前只守 README）
const man = rd('dataset/MANIFEST.md');
ok(); if (/outputs\/07_skills/.test(man)) bad('MANIFEST 仍含死链 outputs/07_skills');
// C) 真实数据基座快照：文件存在 + MANIFEST 溯源(来源/许可)齐全
for (const f of ['retail_online_retail_ii.csv', 'finance_uci_default_credit.csv', 'hospital_cms_ed_timely.csv', 'flights_usdot_ontime.csv']) { ok(); if (!has('dataset/real/' + f)) bad('缺真实基座快照 dataset/real/' + f); }
ok(); if (!/真实基座快照/.test(man) || !/CC BY 4\.0/.test(man) || !/公共领域/.test(man)) bad('MANIFEST 缺真实基座溯源(来源/许可)');
// D) 迁移到真实基座的案例，其 dataset 性质须在 MANIFEST 标为「真实基座」
for (const rel of ['order_data.csv', '28-credit_default_sample.csv', 'hospital_ed_timely.csv', 'flights_ontime.csv']) { const line = man.split('\n').find((l) => l.includes(rel)); ok(); if (!line || !/真实基座/.test(line)) bad(`MANIFEST 未把 ${rel} 标为真实基座`); }
// E) 叠加诚信：合成叠加须显式标注「教学合成」，绝不把合成说成真实
ok(); if (!/教学合成叠加|标注合成叠加/.test(man)) bad('MANIFEST 未标注教学合成叠加列');
// F) 旧的编造具体断言不得复现（噪声当信号的老洞见）
ok(); if (/家居 ?571|心内 ?91|跨境 ?540/.test(tut)) bad('教程仍含旧编造具体断言(家居571/心内91/跨境540)');
// G) 信号-噪声（关键）：真实分组效应须显著，防回退到「噪声当信号」——直接读真实 CSV 复算
const parseCsvV = (p) => { const t = rd(p).trim().split('\n'); const sp = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }; const head = sp(t[0]); return { rows: t.slice(1).map(sp), ci: (n) => head.indexOf(n) }; };
{ const s = parseCsvV('dataset/product_cases/hospital_ed_timely.csv'); const V = s.ci('急诊量级'), W = s.ci('中位急诊时长分');
  const g = {}; for (const r of s.rows) { const k = r[V]; if (k === '未标注') continue; (g[k] ||= [0, 0]); g[k][0]++; g[k][1] += Number(r[W]) || 0; }
  const means = Object.values(g).map(([n, w]) => w / n); const ratio = Math.max(...means) / Math.min(...means);
  ok(); if (!(ratio >= 1.2)) bad(`案例16 急诊量级→等待 组间效应过弱(极差比 ${ratio.toFixed(2)}<1.2，疑似噪声当信号)`); }
{ const s = parseCsvV('dataset/reference_data_analysis/28-credit_default_sample.csv'); const T = s.ci('额度档'), L = s.ci('风险等级');
  const g = {}; for (const r of s.rows) { const k = r[T]; (g[k] ||= [0, 0]); g[k][0]++; if (r[L] === '高') g[k][1]++; }
  const rates = Object.values(g).map(([n, h]) => h / n * 100); const spread = Math.max(...rates) - Math.min(...rates);
  ok(); if (!(spread >= 10)) bad(`案例28 额度档→高风险 组间效应过弱(极差 ${spread.toFixed(1)}pct<10)`); }
{ const s = parseCsvV('dataset/product_cases/flights_ontime.csv'); const C = s.ci('城市'), A = s.ci('异常类型');
  const g = {}; for (const r of s.rows) { const k = r[C]; (g[k] ||= [0, 0]); g[k][0]++; if (r[A] === '延误') g[k][1]++; }
  const rates = Object.values(g).filter(([n]) => n >= 8).map(([n, l]) => l / n * 100); const spread = Math.max(...rates) - Math.min(...rates);
  ok(); if (!(spread >= 15)) bad(`案例14 起飞城市→延误 组间效应过弱(极差 ${spread.toFixed(1)}pct<15，疑似噪声当信号)`); }
// H) 新增教学内容出现性 + 每案去模板字段
for (const m of ['角色 × 能力矩阵', '三个角色镜头', '三条角色阅读路径', '为什么现在学', 'Loop 0', '原理 → 案例 反查', '结课 Capstone', '深度']) { ok(); if (!tut.includes(m)) bad(`教程缺新增内容「${m}」`); }
// v11 重定位 + 新内容出现性守卫
for (const m of ['统一操作模型', '研发镜头', '产品镜头', '项目镜头', '知识 → 技能 → 智慧', '流利度 ≠ 存储强度', 'L0 草稿', 'L3 无人值守', '意图债务', '认知投降', '归纳问题', '没有免费午餐', 'YAGNI', 'AI slop']) { ok(); if (!tut.includes(m)) bad(`v11 缺内容/重定位「${m}」`); }
// PM 血脉保留（产品镜头）
ok(); if (!/产品经理转型|产品镜头/.test(tut)) bad('未保留 PM 转型血脉（应作为产品镜头）');
// 诚信：编造/误植不得出现
ok(); if (/\$8M|800 万 token|CI Sweeper.*48/.test(tut)) bad('含编造的 $8M CI Sweeper 案例');
ok(); if (/休谟[^。]{0,20}(白板|tabula)/.test(tut)) bad('把白板说误植休谟(应为洛克)');
// 图标专业化：产物零 emoji 图标 + 用 vendored SVG
ok(); if (/[\u{1F300}-\u{1FAFF}\u{2B00}-\u{2BFF}\u{2600}-\u{26FF}★☆🟢🔵]/u.test(tut)) bad('教程仍含 emoji 图标/难度星（应换专业 SVG）');
ok(); if (!/lucide\/built\/.*\.svg/.test(tut)) bad('教程未用 vendored 专业 SVG 图标');
// 去 AI 味：禁营销套话/AI 填充词（承接 v10，扩词表）
ok(); if (/赋能|一站式|全方位|深度赋能|值得注意的是|综上所述|众所周知|让我们一起|seamless|delve|elevate|pivotal|tapestry/i.test(tut)) bad('教程含 AI 营销套话/填充词，需去 AI 化');
// Phase 2：角色镜头（每案≥1 合法镜头；三角色各≥3 案；角色切换器 + 01/41 三视角）
for (const c of defs.cases) { ok(); if (!Array.isArray(c.lenses) || c.lenses.length < 1 || !c.lenses.every((l) => ['研发', '产品', '项目'].includes(l))) bad(`案例${c.num} 角色镜头 lenses 缺失/非法`); }
for (const role of ['研发', '产品', '项目']) { ok(); if (defs.cases.filter((c) => (c.lenses || []).includes(role)).length < 3) bad(`角色「${role}」覆盖案例不足 3（伪统一）`); }
ok(); if (!tut.includes('三镜头看同一个案例')) bad('缺角色切换器（三镜头看同一案例）');
for (const n of [1, 41]) { ok(); if (!defs.cases.find((c) => c.num === n)?.lensViews) bad(`案例${n} 缺 lensViews 三视角`); }
// Phase 3：3 个 dogfood 真实案例（48 CI 分诊 / 49 RAG 评测 / 50 交付门禁）——screen 接入 + 效应真实
for (const n of [48, 49, 50]) { const c = defs.cases.find((x) => x.num === n); ok(); if (!c) { bad(`缺 dogfood 案例 ${n}`); continue; } ok(); if (!['triage', 'eval', 'gates'].includes(c.screen)) bad(`案例${n} 缺 dogfood screen`); ok(); if (!/dogfood|本仓库/.test(c.dataset)) bad(`案例${n} dataset 未标 dogfood 真源`); }
ok(); if (!/DogfoodScreen/.test(rd('code/web/src/screens.tsx')) || !/screen === 'triage'/.test(rd('code/web/src/screens.tsx'))) bad('前端缺 DogfoodScreen 或未接入 triage/eval/gates');
{ const j48 = jj('code/data/case_48.json'); ok(); if (!((j48.kpis.find((k) => k.name === '契约断言数')?.value > 0) && (j48.kpis.find((k) => k.name === '接口契约数')?.value >= 10))) bad('案例48 断言/接口契约非真实计算'); }
{ const j49 = jj('code/data/case_49.json'); const hr = j49.kpis.find((k) => k.name === '命中率')?.value; ok(); if (!(hr > 0 && hr <= 100 && j49.kpis.find((k) => k.name === '语料篇数')?.value > 50)) bad('案例49 命中率/语料非真实'); ok(); if (!j49.queue.some((q) => /未命中|低相关/.test(q.state))) bad('案例49 无未命中/错误分析(评测退化)'); }
{ const j50 = jj('code/data/case_50.json'); ok(); if (!(j50.kpis.find((k) => k.name === '门禁检查项')?.value > 100)) bad('案例50 门禁检查项非真实'); ok(); if (j50.kpis.find((k) => k.name === '覆盖角色数')?.value !== 3) bad('案例50 覆盖角色数≠3'); }
ok(); if (!(defs.cases.find((c) => c.num === 48)?.lenses.includes('研发') && defs.cases.find((c) => c.num === 50)?.lenses.includes('项目'))) bad('dogfood 三镜头未平衡');
for (const c of defs.cases) { ok(); if (!c.readingOrder || !c.tryThis) bad(`案例${c.num} 缺去模板字段 readingOrder/tryThis`); }
// I) 叙事钩子诚信：姚顺雨须标为首席科学家(非 PM)；prompt-sets 归 Aparna 而非吴恩达
ok(); if (tut.includes('姚顺雨') && !/姚顺雨[^。]{0,60}首席科学家/.test(tut)) bad('姚顺雨须标注为首席科学家(非产品经理)');
ok(); if (/吴恩达[^。]{0,40}(新的 PRD|提示词集|prompt set)/i.test(tut)) bad('把 prompt-sets/新PRD 误植吴恩达(实为 Aparna Chennapragada)');

console.log(`\n检查 ${checks} 项，失败 ${fail} 项`);
if (fail) { console.log('\n✗ NOT GREEN'); process.exit(1); }
console.log('\n✅ ALL GREEN');
