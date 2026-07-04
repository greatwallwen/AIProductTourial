#!/usr/bin/env node
/** 生成：每案例深色大屏风 SVG + 两份交付物 md + §1-§4 理念图 + 合成单一教程 md。
 *  逻辑：先讲理念/原理/规范/设计（第一部分），再用案例演示验证（第二部分）。工具口径用 Trae/CodeBuddy 等泛指。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const defs = JSON.parse(readFileSync(join(ROOT, 'coderef', 'case_definitions.json'), 'utf8'));
const THEMES = {};
for (const th of JSON.parse(readFileSync(join(ROOT, 'design', 'themes.json'), 'utf8')).themes) THEMES[th.id] = th.t;
const CLIB = join(ROOT, 'outputs', 'product_case_library');
mkdirSync(join(CLIB, 'svg'), { recursive: true });
const pad = (n) => String(n).padStart(2, '0');
const vm = (n) => JSON.parse(readFileSync(join(ROOT, 'coderef', 'react_pm_cases', 'src', 'data', `case_${pad(n)}.json`), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const theme = (id) => THEMES[id] || THEMES['graphite-hud'];

// 每案例深色大屏风信息图（按案例 design 上色 → 各案例风格各异）
function svg(c, d) {
  const t = theme(c.design);
  const W = 960, H = 560, kx = (i) => 40 + i * 178;
  const kpis = d.kpis.slice(0, 5).map((k, i) => `
   <rect x="${kx(i)}" y="104" width="162" height="76" rx="10" fill="${t.panel}" stroke="${t.border}"/>
   <rect x="${kx(i)}" y="104" width="162" height="2" fill="${t.accent}"/>
   <text x="${kx(i) + 12}" y="128" font-size="11" fill="${t.muted}">${esc(k.name).slice(0, 10)}</text>
   <text x="${kx(i) + 12}" y="160" font-size="23" font-weight="750" fill="${t.ink}">${esc(String(k.value))}${esc(k.unit || '')}</text>`).join('');
  const q = d.queue.slice(0, 5).map((row, i) => `
   <rect x="40" y="${248 + i * 42}" width="520" height="34" rx="7" fill="${t.panelSoft}" stroke="${t.border}"/>
   <rect x="52" y="${256 + i * 42}" width="78" height="18" rx="5" fill="${t.bad}" opacity="0.22"/>
   <text x="60" y="${269 + i * 42}" font-size="10.5" fill="${t.bad}" font-weight="700">${esc(row.state).slice(0, 6)}</text>
   <text x="144" y="${269 + i * 42}" font-size="11" fill="${t.ink2}">${esc(Object.values(row.fields)[0] || '')} · ${esc(row.owner || '')}</text>`).join('');
  const acts = d.actions.slice(0, 3).map((a, i) => `
   <rect x="${592 + i * 122}" y="248" width="110" height="42" rx="9" fill="${t.accent}"/>
   <text x="${592 + i * 122 + 12}" y="273" font-size="11" fill="#04121a" font-weight="700">${esc(a.label).slice(0, 8)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="PingFang SC,Microsoft YaHei,sans-serif">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
  <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.5"/>
  <text x="40" y="50" font-size="21" font-weight="750" fill="${t.ink}">${esc(c.scenario)}</text>
  <text x="40" y="74" font-size="12" fill="${t.ink2}">${esc(c.industry)} · ${esc(c.saasType)} · 设计 ${esc(c.design)} · 数据 ${esc(c.dataset)}（${d.rowCount} 行，异常 ${d.exceptionCount}）</text>
  <text x="40" y="96" font-size="11" fill="${t.muted}">读图顺序：指标链 → 异常队列与责任对象 → 行动入口与验收边界</text>
  ${kpis}
  <text x="40" y="230" font-size="12" font-weight="600" fill="${t.ink}">异常队列 · 责任对象</text>
  <text x="592" y="230" font-size="12" font-weight="600" fill="${t.ink}">行动入口</text>
  ${q}${acts}
  <foreignObject x="592" y="308" width="330" height="150"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:11px;color:${t.ink2};line-height:1.6">决策动作：${esc(c.decisionAction)}<br/>风险边界：${esc(c.riskBoundary)}</div></foreignObject>
  ${c.highImpact ? `<rect x="40" y="486" width="880" height="34" rx="8" fill="${t.warn}" opacity="0.14"/><text x="54" y="508" font-size="11.5" fill="${t.warn}">⚠ 高影响行业：保留人工复核，不得自动授信/处罚/诊断/拒绝交易</text>` : ''}
  <text x="40" y="544" font-size="10.5" fill="${t.muted}">UI 原型 ${esc(c.uiId)} · 演示原理 ${(c.demonstrates || []).join(' · ')} · Skill ${esc(c.skills.join(' + '))}</text>
</svg>`;
}

// §1-§4 理念/原理深色信息图
function figSvg(id) {
  const t = theme('graphite-hud');
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 380" font-family="PingFang SC,sans-serif"><rect width="900" height="380" fill="${t.bg}"/><rect width="900" height="380" fill="none"/>`;
  if (id === 'fig_ideology_loops') {
    const ring = (r, col, lab) => `<circle cx="300" cy="190" r="${r}" fill="none" stroke="${col}" stroke-width="2" opacity="0.9"/><text x="300" y="${190 - r + 20}" font-size="12" fill="${col}" text-anchor="middle">${lab}</text>`;
    return head + ring(150, t.muted, '外层 · 真实用户与市场（周）') + ring(105, t.accent2, '中层 · 开发者判断（时）') + ring(60, t.accent, '内层 · Agent 执行（分）') +
      `<text x="620" y="120" font-size="13" fill="${t.ink}">三层 Loop</text><text x="620" y="150" font-size="11" fill="${t.ink2}">一层比一层慢，</text><text x="620" y="172" font-size="11" fill="${t.ink2}">也一层比一层重要。</text><text x="620" y="200" font-size="11" fill="${t.muted}">稀缺能力向外层迁移。</text></svg>`;
  }
  if (id === 'fig_arch_flow') {
    const steps = ['约束先行', '质量属性', '子系统分解', '接口契约', 'ADR 决策', '部署演进'];
    return head + steps.map((s, i) => `<rect x="${30 + i * 142}" y="150" width="126" height="70" rx="10" fill="${t.panel}" stroke="${t.border}"/><rect x="${30 + i * 142}" y="150" width="126" height="2" fill="${t.accent}"/><text x="${30 + i * 142 + 63}" y="192" font-size="13" fill="${t.ink}" text-anchor="middle">${s}</text>${i < 5 ? `<text x="${30 + i * 142 + 133}" y="190" font-size="16" fill="${t.accent}">›</text>` : ''}`).join('') +
      `<text x="30" y="90" font-size="14" fill="${t.ink}">产品视角系统架构设计流程</text><text x="30" y="300" font-size="11" fill="${t.muted}">架构=特定约束下对质量属性做出的一组可追溯决策</text></svg>`;
  }
  if (id === 'fig_engineering_rules') {
    const rs = ['成熟优先', 'DRY 复用', '目录清晰', '单文件≤800行', '类型安全', '中文注释', '错误处理', '安全红线'];
    return head + rs.map((s, i) => `<rect x="${30 + (i % 4) * 215}" y="${90 + Math.floor(i / 4) * 110}" width="195" height="90" rx="10" fill="${t.panel}" stroke="${t.border}"/><text x="${30 + (i % 4) * 215 + 16}" y="${90 + Math.floor(i / 4) * 110 + 50}" font-size="14" fill="${t.accent}">${s}</text>`).join('') + '</svg>';
  }
  // fig_designs
  const ids = Object.keys(THEMES);
  return head + ids.map((k, i) => { const tt = THEMES[k]; return `<rect x="${30 + i * 172}" y="120" width="156" height="140" rx="12" fill="${tt.panel}" stroke="${tt.border}"/><rect x="${46 + i * 172}" y="140" width="124" height="40" rx="8" fill="${tt.accent}"/><text x="${46 + i * 172}" y="210" font-size="12" fill="${tt.ink}">${k}</text>`; }).join('') + `<text x="30" y="80" font-size="14" fill="${t.ink}">多套设计系统（各不相同）</text></svg>`;
}

// 交付物卡（问题定义 / 方案验收）
function kv(pairs) { return pairs.map(([k, v]) => `- ${k}：${v}`).join('\n'); }
function deliverableMd(c, d, type) {
  const head = `# ${c.deliverable}（实操 ${pad(c.num)}·${type}）\n\n> 数据来源：\`${c.dataset}\`（${d.rowCount} 行，异常 ${d.exceptionCount}）。字段与指标均回到该数据。演示原理 ${(c.demonstrates || []).join('、')}，采用设计 ${c.design}。\n`;
  if (type === '问题定义')
    return head + `\n## 产品问题\n\n${c.story}\n\n## 岗位与业务对象\n\n${kv([['岗位', c.role], ['业务对象', c.scenario], ['行业', c.industry]])}\n\n## 指标链（取自真实数据）\n\n${d.kpis.map((k) => `- ${k.name}：${k.value}${k.unit || ''}（${k.trend}）`).join('\n')}\n\n## 异常状态与责任\n\n${d.queue.slice(0, 6).map((q) => `- [${q.state}] ${Object.values(q.fields).slice(0, 3).join(' / ')} → 责任 ${q.owner}`).join('\n')}\n\n## 决策动作\n\n${c.decisionAction}\n\n## 风险边界\n\n${c.riskBoundary}${c.highImpact ? '（高影响行业：保留人工复核，不得自动决策）' : ''}\n\n## 使用 Skill\n\n${c.skills.join('、')}\n`;
  return head + `\n## 交付物\n\n${c.deliverable}\n\n## 验收清单\n\n${kv([['必含字段', c.fields.join('、')], ['必含指标链', c.metricChain.join('、')], ['必含异常状态', c.exceptionStates.join('、')], ['必含 Skill', c.skills.join('、')]])}\n\n## 合格标准\n\n业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。\n\n## 不合格标准\n\n使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「${c.riskBoundary}」。\n\n## 验收结论\n\nPASS — 指标链 ${d.kpis.length} 项、异常队列 ${d.exceptionCount} 项均回到 \`${c.dataset}\`；可运行原型见工作台路由 \`#/case/${pad(c.num)}\`（设计 ${c.design}），截图 \`assets/screenshots/premium_case_${pad(c.num)}_${c.slug}_desktop.png\`。\n`;
}

// 构建契约式 Prompt（工具无关，用 Trae/CodeBuddy 等泛指）
function buildPrompt(c, d, stage) {
  return `请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「${c.scenario}」的${stage === 'def' ? '产品问题定义' : '方案验收'}，并产出可运行原型：
- 场景与岗位：${c.role} 面向「${c.scenario}」，把判断转成可验证的产品交付物；核心是把指标→异常→责任→行动连成闭环。
- 数据：读取 \`${c.dataset}\`，只使用数据/资料中存在的字段（${c.fields.join('、')}）。
- 指标链：${c.metricChain.join('、')}（当前真实值：${d.kpis.map((k) => k.name + '=' + k.value + (k.unit || '')).join('，')}）。
- 异常状态：${c.exceptionStates.join('、')}。
- 使用 Skill：${c.skills[0]}、${c.skills[1]}，并用 ${c.skills[2]} 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 \`coderef/react_pm_cases\`（Vite+React+TS）路由 \`#/case/${pad(c.num)}\`，按 \`${c.uiId}\`（${c.saasType}）与设计 \`${c.design}\` 渲染；数据经 \`build_case_data.mjs\` 预计算，页面必须体现指标链、异常队列、责任对象与行动入口，不得复用通用表格占位。
- 输出：${c.deliverable}，保存为 \`outputs/product_case_library/case_${pad(c.num)}_${c.slug}_${stage === 'def' ? '问题定义' : '方案验收'}.md\`。
- 验收条件：结论回到数据或公开参考（${c.publicRef}）；不得越过「${c.riskBoundary}」${c.highImpact ? '；高影响行业保留人工复核' : ''}；\`node coderef/verify_course_package.mjs\` 必须 ALL GREEN。`;
}

// ============ 生成 SVG + 交付物 ============
for (const id of ['fig_ideology_loops', 'fig_arch_flow', 'fig_engineering_rules', 'fig_designs'])
  writeFileSync(join(CLIB, 'svg', `${id}.svg`), figSvg(id));
for (const c of defs.cases) {
  const d = vm(c.num);
  writeFileSync(join(CLIB, 'svg', `case_${pad(c.num)}_${c.slug}.svg`), svg(c, d));
  writeFileSync(join(CLIB, `case_${pad(c.num)}_${c.slug}_问题定义.md`), deliverableMd(c, d, '问题定义'));
  writeFileSync(join(CLIB, `case_${pad(c.num)}_${c.slug}_方案验收.md`), deliverableMd(c, d, '方案验收'));
}

// ============ 合成单一教程 md ============
const src = (f) => readFileSync(join(ROOT, 'docs', '_source', f), 'utf8').trim();
const H = [`# ${defs.projectName}`, '',
  `> 面向技术骨干与项目经理的产品经理转型实操知识库。**整体逻辑：先讲系统设计的理念、原理、工程规范与多套设计，再用不同案例来演示、验证**。真数据、可运行深色大屏原型（\`coderef/react_pm_cases\`）、真截图、结构化 Skill、Node 校验护栏。`, '',
  `> 写法：构建契约式 Prompt + 可运行成品 + 跑通纠错 + 交付物验收；可用 Trae / CodeBuddy 等任一 Agent 工具（Loop 为工具无关的开发模式）。数据真实/合成显式标注（\`dataset/MANIFEST.md\`）；高影响行业保留人工复核。`, '',
  '# 第一部分 · 系统设计理念与原理', '',
  src('01-ideology.md'), '', src('02-architecture.md'), '', src('03-engineering.md'), '', src('04-designs.md'), '',
  '## 使用入口', '',
  '- 案例总览与 5 个 manifest：`outputs/product_case_library/*.json`',
  '- 多套设计系统：`design/*.md`（令牌 `design/themes.json`）｜工程规范：`rules/`｜Skill 与 Loop：`skills/`',
  '- React 工作台：`coderef/react_pm_cases`（`npm ci && npm run build && npm run preview`，一案例一路由 `#/case/NN`）',
  '- 数据：`node coderef/fetch-datasets.mjs`｜预计算：`node coderef/build_case_data.mjs`｜校验：`node coderef/verify_course_package.mjs`', '',
  '# 第二部分 · 案例演示与验证', '',
  '## 案例总览', '',
  '| # | 场景 | 行业 | 阶段 | 演示原理 | 设计 | UI 原型 | Skill |', '|---|---|---|---|---|---|---|---|'];
for (const c of defs.cases) H.push(`| ${pad(c.num)} | ${c.scenario} | ${c.industry} | ${c.phase} | ${(c.demonstrates || []).join('/')} | ${c.design} | \`${c.uiId}\` | ${c.skills.join('+')} |`);
H.push('');
for (const c of defs.cases) {
  const d = vm(c.num);
  H.push(`\n---\n\n## 实操 ${pad(c.num)}：${c.title}\n`);
  H.push(`> **本案例演示/验证**：原理 ${(c.demonstrates || []).join('、')}｜**采用设计** \`${c.design}\`（见 design/${c.design}.md）\n`);
  H.push(`### 项目场景故事\n\n${c.story}\n\n**现状问题**\n\n- 决策依赖的关键指标：${c.metricChain.join('、')}。\n- 现场常见异常：${c.exceptionStates.join('、')}。\n- 只做通用页面无法支撑「${c.decisionAction}」。\n\n**本次任务**\n\n- 明确岗位、指标链、异常状态与决策动作。\n- 使用 \`${c.skills[0]}\` 与 \`${c.skills[1]}\` 完成分析，产出 \`${c.deliverable}\`，用 \`${c.skills[2]}\` 验收。\n`);
  H.push(`### 任务目标与数据\n\n${kv([['行业', c.industry], ['真实业务场景', c.scenario], ['岗位', c.role], ['数据或资料', '`' + c.dataset + '`（' + d.rowCount + ' 行，异常 ' + d.exceptionCount + '）'], ['公开参考', c.publicRef], ['行业字段', c.fields.join('、')], ['指标链（真实值）', d.kpis.map((k) => k.name + ' ' + k.value + (k.unit || '')).join('，')], ['决策动作', c.decisionAction], ['风险边界', c.riskBoundary + (c.highImpact ? '（高影响行业·人工复核）' : '')], ['UI 原型', '`' + c.uiId + '`（' + c.saasType + '）'], ['采用设计', c.design], ['SaaS 组件', c.saasComponents.join('、')]])}\n`);
  H.push(`### Prompt 实操\n\n**Prompt 1：${c.scenario} - 问题定义**\n\n\`\`\`text\n${buildPrompt(c, d, 'def')}\n\`\`\`\n\n**Prompt 2：${c.scenario} - 方案验收**\n\n\`\`\`text\n${buildPrompt(c, d, 'accept')}\n\`\`\`\n`);
  H.push(`### 图形/原型/表单\n\n![${c.scenario} · 信息图](outputs/product_case_library/svg/case_${pad(c.num)}_${c.slug}.svg)\n\n![${c.scenario} · 可运行大屏原型截图](assets/screenshots/premium_case_${pad(c.num)}_${c.slug}_desktop.png)\n\n- 图形类型：${c.slug}（设计 ${c.design}）\n- 看图顺序：先看指标链，再看异常队列和责任对象，最后看行动入口与验收边界。\n- UI 差异：本案例采用 \`${c.uiId}\` + 设计 \`${c.design}\`，不得复用通用表格占位；可运行原型见 \`#/case/${pad(c.num)}\`。\n`);
  H.push(`### 交付物与验收\n\n${kv([['交付物', c.deliverable], ['必含字段', c.fields.join('、')], ['必含指标链', c.metricChain.join('、')], ['必含异常状态', c.exceptionStates.join('、')], ['必含 Skill', c.skills.join('、')]])}\n\n- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。\n- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「${c.riskBoundary}」。\n- 交付物文件：\`outputs/product_case_library/case_${pad(c.num)}_${c.slug}_问题定义.md\`、\`…_方案验收.md\`。\n`);
  if (c.rp) H.push(`\n**指定实操融合**\n\n- ${c.rp.id}：${c.rp.title}\n  - 产出：${c.rp.produce}\n  - 验收：${c.rp.accept}\n`);
  H.push(`\n**跑通与纠错**：\`npm run build\` 通过后 \`npm run preview\` 访问 \`#/case/${pad(c.num)}\`；遵 rules/ 约束（单文件<800行、DRY、TS、中文注释）；\`verify_course_package.mjs\` 逐项核验字段/指标/Skill/截图/设计。\n`);
}
writeFileSync(join(ROOT, '产品经理转型实操知识库.md'), H.join('\n') + '\n');
console.log('单一教程 md + SVG + 交付物 生成完毕。cases', defs.cases.length, '| figs 4');
