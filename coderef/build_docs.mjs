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

// 状态严重度 → 主题色
function sevColor(t, s) {
  if (/严重|高|越界|拒|失败|未闭环|未达成|超时|不足|待复核|越权/.test(s)) return t.bad;
  if (/预警|中|滞销|阻塞|待|下滑|异常/.test(s)) return t.warn;
  if (/GREEN|通过|正常|完成/.test(s)) return t.ok;
  return t.accent2;
}
// 数据驱动图表面板（柱/漏斗/管线/折线），含网格、坐标轴、数值、标签
function chartSvg(t, chart, X, Y, W, H) {
  const base = Y + H - 22, top = Y + 6, ph = base - top;
  if (!chart || !chart.data || !chart.data.length) return `<text x="${X + W / 2}" y="${Y + H / 2}" font-size="11" fill="${t.muted}" text-anchor="middle">无图表数据</text>`;
  const grid = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="${X}" y1="${(base - ph * f).toFixed(1)}" x2="${X + W}" y2="${(base - ph * f).toFixed(1)}" stroke="${t.grid}" stroke-dasharray="2 3"/>`).join('');
  const axis = `<line x1="${X}" y1="${base}" x2="${X + W}" y2="${base}" stroke="${t.border}"/><line x1="${X}" y1="${top}" x2="${X}" y2="${base}" stroke="${t.border}"/>`;
  if (chart.type === 'bars' || chart.type === 'pipeline') {
    const key = chart.type === 'bars' ? 'value' : 'count', lab = chart.type === 'bars' ? 'label' : 'stage';
    const data = chart.data.slice(0, 7); const max = Math.max(...data.map((x) => x[key])) || 1; const bw = (W - 12) / data.length;
    const bars = data.map((x, i) => { const h = (x[key] / max) * ph; const bx = X + 6 + i * bw; return `<rect x="${bx.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - 10).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${t.accent}" opacity="0.9"/><text x="${(bx + (bw - 10) / 2).toFixed(1)}" y="${(base - h - 4).toFixed(1)}" font-size="8.5" fill="${t.ink2}" text-anchor="middle">${esc(String(x[key]))}</text><text x="${(bx + (bw - 10) / 2).toFixed(1)}" y="${base + 13}" font-size="8" fill="${t.muted}" text-anchor="middle">${esc(String(x[lab] ?? '').slice(0, 5))}</text>`; }).join('');
    return grid + axis + bars;
  }
  if (chart.type === 'funnel') {
    const data = chart.data.slice(0, 7); const max = data[0].value || 1; const rh = ph / data.length;
    return grid + data.map((x, i) => { const w = (x.value / max) * W; return `<rect x="${(X + (W - w) / 2).toFixed(1)}" y="${(top + i * rh + 2).toFixed(1)}" width="${w.toFixed(1)}" height="${(rh - 5).toFixed(1)}" rx="3" fill="${t.accent}" opacity="${(0.9 - i * 0.08).toFixed(2)}"/><text x="${X + W / 2}" y="${(top + i * rh + rh / 2 + 3).toFixed(1)}" font-size="9" fill="#04121a" text-anchor="middle" font-weight="700">${esc(String(x.stage))} · ${esc(String(x.value))}</text>`; }).join('');
  }
  const ys = chart.data.map((x) => x.y); const mx = Math.max(...ys), mn = Math.min(...ys);
  const pts = chart.data.map((x, i) => `${(X + (i / (chart.data.length - 1)) * W).toFixed(1)},${(base - ((x.y - mn) / ((mx - mn) || 1)) * ph).toFixed(1)}`);
  return grid + axis + `<polygon points="${X},${base} ${pts.join(' ')} ${X + W},${base}" fill="${t.accent}" opacity="0.12"/><polyline points="${pts.join(' ')}" fill="none" stroke="${t.accent}" stroke-width="2.5" filter="url(#glow)"/>` + chart.data.map((x, i) => `<circle cx="${(X + (i / (chart.data.length - 1)) * W).toFixed(1)}" cy="${(base - ((x.y - mn) / ((mx - mn) || 1)) * ph).toFixed(1)}" r="2.5" fill="${t.accent2}"/>`).join('');
}
// 每案例深色大屏风信息图（专业级：头部/KPI/数据驱动图表/严重度队列/行动·决策；按案例 design 上色）
function svg(c, d) {
  const t = theme(c.design);
  const W = 1000, H = 620, kpiY = 116, kx = (i) => 36 + i * 190;
  const kpis = d.kpis.slice(0, 5).map((k, i) => {
    const tr = String(k.trend || ''); const up = tr.startsWith('+'); const tc = up ? t.ok : t.bad;
    return `<rect x="${kx(i)}" y="${kpiY}" width="176" height="82" rx="11" fill="${t.panel}" stroke="${t.border}"/>
    <rect x="${kx(i)}" y="${kpiY}" width="176" height="3" rx="1.5" fill="url(#acc)"/>
    <circle cx="${kx(i) + 20}" cy="${kpiY + 23}" r="7" fill="none" stroke="${t.accent}" stroke-width="1.5"/><circle cx="${kx(i) + 20}" cy="${kpiY + 23}" r="2.5" fill="${t.accent}"/>
    <text x="${kx(i) + 34}" y="${kpiY + 27}" font-size="10.5" fill="${t.muted}">${esc(k.name).slice(0, 9)}</text>
    <text x="${kx(i) + 14}" y="${kpiY + 60}" font-size="24" font-weight="750" fill="${t.ink}">${esc(String(k.value))}<tspan font-size="12" fill="${t.muted}">${esc(k.unit || '')}</tspan></text>
    ${tr ? `<text x="${kx(i) + 162}" y="${kpiY + 60}" font-size="11" fill="${tc}" text-anchor="end">${up ? '▲' : '▼'}${esc(tr.replace(/^[+-]/, ''))}</text>` : ''}`;
  }).join('');
  const q = d.queue.slice(0, 5).map((row, i) => { const sc = sevColor(t, row.state); const y = 264 + i * 34; return `
    <rect x="524" y="${y}" width="440" height="28" rx="7" fill="${t.panelSoft}" stroke="${t.border}"/>
    <rect x="532" y="${y + 7}" width="4" height="14" rx="2" fill="${sc}"/>
    <rect x="544" y="${y + 6}" width="70" height="16" rx="5" fill="${sc}" opacity="0.2"/><text x="550" y="${y + 18}" font-size="9.5" fill="${sc}" font-weight="700">${esc(row.state).slice(0, 6)}</text>
    <text x="624" y="${y + 18}" font-size="10" fill="${t.ink2}">${esc(String(Object.values(row.fields || {})[0] || '')).slice(0, 16)}</text>
    <rect x="884" y="${y + 6}" width="72" height="16" rx="8" fill="${t.accent2}" opacity="0.16"/><text x="920" y="${y + 18}" font-size="9.5" fill="${t.accent2}" text-anchor="middle">${esc(row.owner || '—').slice(0, 6)}</text>`; }).join('');
  const acts = d.actions.slice(0, 3).map((a, i) => `
    <rect x="${36 + i * 180}" y="548" width="168" height="46" rx="10" fill="url(#acc)"/>
    <text x="${36 + i * 180 + 14}" y="569" font-size="11.5" fill="#04121a" font-weight="750">${esc(a.label).slice(0, 10)}</text>
    <text x="${36 + i * 180 + 14}" y="584" font-size="9" fill="#04121a" opacity="0.75">${esc((a.owner || '') + ' · ' + (a.due || ''))}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="PingFang SC,Microsoft YaHei,sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern>
    <filter id="glow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.4"/>
  <rect x="0" y="0" width="${W}" height="92" fill="${t.panel}" opacity="0.45"/>
  <rect x="36" y="28" width="4" height="36" rx="2" fill="url(#acc)"/>
  <text x="50" y="46" font-size="22" font-weight="750" fill="${t.ink}">${esc(c.scenario)}</text>
  <text x="50" y="70" font-size="11.5" fill="${t.ink2}">${esc(c.industry)} · ${esc(c.saasType)} · 数据 ${esc(c.dataset)}（${d.rowCount} 行 · 异常 ${d.exceptionCount}）</text>
  <rect x="${W - 258}" y="26" width="222" height="22" rx="11" fill="${t.panelSoft}" stroke="${t.border}"/><text x="${W - 147}" y="41" font-size="10" fill="${t.accent}" text-anchor="middle">设计 ${esc(c.design)} · ${esc(c.systemLayer || '')}·${esc(c.systemStage || '')}</text>
  <text x="${W - 36}" y="70" font-size="9.5" fill="${t.muted}" text-anchor="end">读图：指标链 → 异常队列/责任 → 行动/验收</text>
  ${kpis}
  <rect x="24" y="216" width="476" height="230" rx="12" fill="${t.panel}" stroke="${t.border}"/>
  <text x="40" y="240" font-size="12.5" font-weight="650" fill="${t.ink}">指标趋势 / 结构</text><rect x="40" y="246" width="28" height="2" fill="${t.accent}"/>
  <text x="484" y="240" font-size="9.5" fill="${t.muted}" text-anchor="end">${esc((c.largeScreenRef || '').slice(0, 16))}</text>
  ${chartSvg(t, d.chart, 44, 256, 432, 176)}
  <rect x="512" y="216" width="464" height="230" rx="12" fill="${t.panel}" stroke="${t.border}"/>
  <text x="528" y="240" font-size="12.5" font-weight="650" fill="${t.ink}">异常队列 · 责任对象</text><rect x="528" y="246" width="28" height="2" fill="${t.warn}"/>
  <text x="960" y="240" font-size="9.5" fill="${t.muted}" text-anchor="end">${d.exceptionCount} 项 · 取前 ${Math.min(5, d.queue.length)}</text>
  ${q}
  ${c.highImpact ? `<rect x="36" y="460" width="940" height="30" rx="8" fill="${t.warn}" opacity="0.14"/><text x="50" y="479" font-size="11" fill="${t.warn}">⚠ 高影响行业：保留人工复核，不得自动授信/处罚/诊断/拒绝交易</text>` : `<text x="36" y="479" font-size="10.5" fill="${t.muted}">演示原理 ${(c.demonstrates || []).join(' · ')} · UI ${esc(c.uiId)} · Skill ${esc(c.skills.join(' + '))}</text>`}
  <text x="36" y="522" font-size="11" fill="${t.muted}">行动入口 · 责任 · 时限</text>
  ${acts}
  <rect x="588" y="510" width="388" height="88" rx="10" fill="${t.panelSoft}" stroke="${t.border}"/>
  <foreignObject x="602" y="516" width="360" height="76"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10.5px;color:${t.ink2};line-height:1.5">决策动作：${esc(c.decisionAction)}<br/>风险边界：${esc(c.riskBoundary)}</div></foreignObject>
</svg>`;
}

// §1-§4 理念/原理深色信息图
function figSvg(id) {
  const t = theme('graphite-hud');
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 380" font-family="PingFang SC,Microsoft YaHei,sans-serif">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
  <pattern id="g" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern>
  <filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect width="900" height="380" fill="url(#bg)"/><rect width="900" height="380" fill="url(#g)" opacity="0.4"/><rect x="0" y="0" width="6" height="380" fill="url(#acc)"/>`;
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
  if (id === 'fig_ai_foundations') {
    const chain = ['LLM', 'Token', 'Context', 'Prompt', 'Tool', 'MCP', 'Agent', 'Skill'];
    return head + chain.map((s, i) => `<rect x="${20 + i * 108}" y="160" width="94" height="60" rx="9" fill="${t.panel}" stroke="${t.border}"/><rect x="${20 + i * 108}" y="160" width="94" height="2" fill="${t.accent}"/><text x="${20 + i * 108 + 47}" y="196" font-size="13" fill="${t.ink}" text-anchor="middle">${s}</text>${i < chain.length - 1 ? `<text x="${20 + i * 108 + 100}" y="196" font-size="15" fill="${t.accent}">›</text>` : ''}`).join('') +
      `<text x="20" y="90" font-size="14" fill="${t.ink}">AI 核心概念底层链路（从底层到上层）</text><text x="20" y="300" font-size="11" fill="${t.muted}">LLM 逐词生成 · Token 计量 · Context 记忆 · Prompt 驱动 · Tool/MCP 触达 · Agent/Skill 自主</text></svg>`;
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

// 数字化系统全景：纵向三层 × 横向数据价值闭环，25 案例作为节点串成一个系统
function panoramaSvg() {
  const t = theme('graphite-hud');
  const W = 1240, H = 720;
  const stages = ['采集', '治理', '洞察', '决策', '执行', '验收', '增长'];
  const stageFull = ['采集接入', '治理存储', '洞察分析', '决策研判', '执行落地', '质量验收', '增长闭环'];
  const layers = ['业务应用', '能力智能', '底座平台'];
  const x0 = 70, colW = (W - x0 - 30) / stages.length, y0 = 100, rowH = 176;
  const cells = {};
  for (const c of defs.cases) { const li = layers.indexOf(c.systemLayer); const si = Math.max(0, stages.indexOf(c.systemStage)); (cells[li + '|' + si] = cells[li + '|' + si] || []).push(c); }
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="PingFang SC,Microsoft YaHei,sans-serif">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.35"/>
  <rect x="36" y="24" width="4" height="34" rx="2" fill="${t.accent}"/>
  <text x="50" y="42" font-size="22" font-weight="750" fill="${t.ink}">数字化系统全景 · 25 案例串成一个系统</text>
  <text x="50" y="64" font-size="12" fill="${t.ink2}">纵向三层（业务应用 / 能力智能 / 底座平台）× 横向数据价值闭环（采集→治理→洞察→决策→执行→验收→增长→回采集）</text>`;
  for (let i = 0; i < stages.length; i++) {
    const cx = x0 + i * colW + colW / 2;
    s += `<text x="${cx.toFixed(0)}" y="${y0 - 8}" font-size="11.5" font-weight="650" fill="${t.accent}" text-anchor="middle">${stageFull[i]}</text>`;
    if (i < stages.length - 1) s += `<text x="${(x0 + (i + 1) * colW).toFixed(0)}" y="${y0 - 8}" font-size="13" fill="${t.muted}" text-anchor="middle">›</text>`;
  }
  for (let r = 0; r < layers.length; r++) {
    const y = y0 + r * rowH;
    s += `<rect x="${x0}" y="${y}" width="${(colW * stages.length).toFixed(0)}" height="${rowH - 16}" rx="10" fill="${t.panel}" opacity="0.4" stroke="${t.border}"/>`;
    s += `<text x="36" y="${y + 22}" font-size="12.5" font-weight="700" fill="${r === 2 ? t.accent2 : t.ink}" transform="rotate(-90 36 ${y + 22})" text-anchor="end">${layers[r]}</text>`;
  }
  for (let i = 0; i <= stages.length; i++) s += `<line x1="${(x0 + i * colW).toFixed(0)}" y1="${y0}" x2="${(x0 + i * colW).toFixed(0)}" y2="${y0 + layers.length * rowH - 16}" stroke="${t.grid}"/>`;
  for (const key in cells) {
    const [li, si] = key.split('|').map(Number);
    const list = cells[key].slice(0, 4);
    list.forEach((c, k) => {
      const nx = x0 + si * colW + 8, ny = y0 + li * rowH + 34 + k * 32;
      const col = c.systemLayer === '底座平台' ? t.accent2 : (c.systemLayer === '能力智能' ? t.warn : t.accent);
      s += `<rect x="${nx.toFixed(0)}" y="${ny}" width="${(colW - 16).toFixed(0)}" height="27" rx="6" fill="${t.panelSoft}" stroke="${col}" stroke-opacity="0.5"/>
      <rect x="${nx.toFixed(0)}" y="${ny}" width="3" height="27" rx="1.5" fill="${col}"/>
      <text x="${(nx + 10).toFixed(0)}" y="${ny + 18}" font-size="9.5" fill="${t.ink2}"><tspan fill="${col}" font-weight="700">${pad(c.num)}</tspan> ${esc(c.scenario.slice(0, 6))}</text>`;
    });
    if (cells[key].length > 4) s += `<text x="${(x0 + si * colW + 12).toFixed(0)}" y="${(y0 + li * rowH + 34 + 4 * 32 + 14)}" font-size="9" fill="${t.muted}">+${cells[key].length - 4} 更多</text>`;
  }
  s += `<text x="50" y="${H - 18}" font-size="10.5" fill="${t.muted}">底座平台（44 向量库 / 45 关系库 / 46 架构契约 / 47 三维）支撑上层；业务应用按闭环各就各位——同一套数字化系统，25 案例是它不同环节的实操演示。</text></svg>`;
  return s;
}

// ============ 生成 SVG + 交付物 ============
writeFileSync(join(CLIB, 'svg', 'fig_system_panorama.svg'), panoramaSvg());
for (const id of ['fig_ai_foundations', 'fig_ideology_loops', 'fig_arch_flow', 'fig_engineering_rules', 'fig_designs'])
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
  src('00-ai-foundations.md'), '', src('01-ideology.md'), '', src('02-architecture.md'), '', src('03-engineering.md'), '', src('04-designs.md'), '',
  '## 使用入口', '',
  '- 案例总览与 5 个 manifest：`outputs/product_case_library/*.json`',
  '- 多套设计系统：`design/*.md`（令牌 `design/themes.json`）｜工程规范：`rules/`｜Skill 与 Loop：`skills/`',
  '- React 工作台：`coderef/react_pm_cases`（`npm ci && npm run build && npm run preview`，一案例一路由 `#/case/NN`）',
  '- 数据：`node coderef/fetch-datasets.mjs`｜预计算：`node coderef/build_case_data.mjs`｜校验：`node coderef/verify_course_package.mjs`', '',
  '# 第二部分 · 案例演示与验证', '',
  '## 数字化系统全景（先看这张图）', '',
  '第一部分讲的理念、原理、规范、设计，不是散点——它们共同构成**一套数字化系统**。后面 25 个案例，正是这套系统在不同环节、不同层的**实操演示**：',
  '',
  '![数字化系统全景](outputs/product_case_library/svg/fig_system_panorama.svg)',
  '',
  '- **纵向三层**：`底座平台`（数据接入/存储/治理/架构，44 向量库·45 关系库·46 架构契约·47 三维）→ `能力智能`（指标/检索/AI）→ `业务应用`（业务场景）。底座支撑上层。',
  '- **横向数据价值闭环**：`采集接入 → 治理存储 → 洞察分析 → 决策研判 → 执行落地 → 质量验收 → 增长闭环`，再反馈回采集。每个业务案例都是这条闭环上的一个节点。',
  '- **怎么读**：先在全景里定位一个案例在「哪一层·哪一环节」，再进它的章节看它把前面**哪条理论落成了什么实际操作**。',
  '', '## 案例总览', '',
  '| # | 场景 | 行业 | 阶段 | 演示原理 | 设计 | UI 原型 | Skill |', '|---|---|---|---|---|---|---|---|'];
for (const c of defs.cases) H.push(`| ${pad(c.num)} | ${c.scenario} | ${c.industry} | ${c.phase} | ${(c.demonstrates || []).join('/')} | ${c.design} | \`${c.uiId}\` | ${c.skills.join('+')} |`);
H.push('');
for (const c of defs.cases) {
  const d = vm(c.num);
  H.push(`\n---\n\n## 实操 ${pad(c.num)}：${c.title}\n`);
  H.push(`> **本案例演示/验证**：原理 ${(c.demonstrates || []).join('、')}｜**采用设计** \`${c.design}\`（见 design/${c.design}.md）\n`);
  H.push(`> **在数字化系统中的位置**：${c.systemLayer}层 · ${c.systemStage}环节｜**理论→实操**：${c.theoryOp}\n`);
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
