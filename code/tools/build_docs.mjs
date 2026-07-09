#!/usr/bin/env node
/** 生成：每案例深色大屏风 SVG + 两份交付物 md + §1-§4 理念图 + 合成单一教程 md。
 *  逻辑：先讲理念/原理/规范/设计（第一部分），再用案例演示验证（第二部分）。工具口径以 CodeBuddy(国产可跑)为主、任一 Agent 工具通用。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { archFigures, subsystemDeps } from './arch_figures.mjs';
import { chapterFigures } from './chapter_figures.mjs';
import { iconInner } from './diagram.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
// v17 P0-1：数据性质措辞单一真源——synthetic 绝不称「真实」
const dkLabel = (c) => c.dataKind === 'synthetic' ? '教学合成数据（固定种子，非真实业务）' : c.dataKind === 'hybrid' ? '真实基座 + 已标注教学合成叠加列' : '真实数据';
const dkNote = (c) => c.dataKind === 'synthetic' ? `> **数据性质：教学合成**（固定种子生成，设计说明见 dataset/design/case_${pad(c.num)}.md）——分层与效应为教学而设，不代表真实业务分布。\n\n` : '';

const defs = JSON.parse(readFileSync(join(ROOT, 'code', 'tools', 'case_definitions.json'), 'utf8'));
const THEMES = {};
for (const th of JSON.parse(readFileSync(join(ROOT, 'design', 'themes.json'), 'utf8')).themes) THEMES[th.id] = th.t;
const CLIB = join(ROOT, 'outputs', 'product_case_library');
mkdirSync(join(CLIB, 'svg'), { recursive: true });
const pad = (n) => String(n).padStart(2, '0');
const vm = (n) => JSON.parse(readFileSync(join(ROOT, 'code', 'data', `case_${pad(n)}.json`), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const theme = (id) => THEMES[id] || THEMES['graphite-hud'];
// 加载 vendored 的真实图标（Lucide，ISC 许可，assets/vendor/lucide）→ 取内层路径内联
const loadIcon = iconInner; // 复用 diagram.mjs 的同款加载器（消一处重复）

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
  ${c.highImpact ? `<rect x="36" y="460" width="940" height="30" rx="8" fill="${t.warn}" opacity="0.14"/><text x="50" y="479" font-size="11" fill="${t.warn}">高影响行业：保留人工复核，不得自动授信/处罚/诊断/拒绝交易</text>` : `<text x="36" y="479" font-size="10.5" fill="${t.muted}">演示原理 ${(c.demonstrates || []).join(' · ')} · UI ${esc(c.uiId)} · Skill ${esc(c.skills.join(' + '))}</text>`}
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
  if (id === 'fig_engineering_rules') {
    const rs = ['成熟优先', 'DRY 复用', '目录清晰', '单文件≤800行', '类型安全', '中文注释', '错误处理', '安全红线'];
    return head + rs.map((s, i) => `<rect x="${30 + (i % 4) * 215}" y="${90 + Math.floor(i / 4) * 110}" width="195" height="90" rx="10" fill="${t.panel}" stroke="${t.border}"/><text x="${30 + (i % 4) * 215 + 16}" y="${90 + Math.floor(i / 4) * 110 + 50}" font-size="14" fill="${t.accent}">${s}</text>`).join('') + '</svg>';
  }
  if (id === 'fig_ai_foundations') {
    const chain = ['LLM', 'Token', 'Context', 'Prompt', 'Tool', 'MCP', 'Agent', 'Skill'];
    const icons = ['brain', 'binary', 'layers', 'workflow', 'box', 'network', 'cpu', 'boxes'];
    return head + chain.map((s, i) => { const bx = 20 + i * 108, inner = loadIcon(icons[i]);
      return `<rect x="${bx}" y="152" width="94" height="72" rx="9" fill="${t.panel}" stroke="${t.border}"/><rect x="${bx}" y="152" width="94" height="2" fill="${t.accent}"/>
      <g transform="translate(${bx + 37},164) scale(0.85)" stroke="${t.accent}" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
      <text x="${bx + 47}" y="212" font-size="13" fill="${t.ink}" text-anchor="middle">${s}</text>${i < chain.length - 1 ? `<text x="${bx + 100}" y="192" font-size="15" fill="${t.accent}">›</text>` : ''}`; }).join('') +
      `<text x="20" y="90" font-size="14" fill="${t.ink}">AI 核心概念底层链路（从底层到上层）</text><text x="20" y="300" font-size="11" fill="${t.muted}">LLM 逐词生成 · Token 计量 · Context 记忆 · Prompt 驱动 · Tool/MCP 触达 · Agent/Skill 自主 · 图标 Lucide(ISC)</text></svg>`;
  }
  // fig_designs
  const ids = Object.keys(THEMES);
  return head + ids.map((k, i) => { const tt = THEMES[k]; return `<rect x="${30 + i * 172}" y="120" width="156" height="140" rx="12" fill="${tt.panel}" stroke="${tt.border}"/><rect x="${46 + i * 172}" y="140" width="124" height="40" rx="8" fill="${tt.accent}"/><text x="${46 + i * 172}" y="210" font-size="12" fill="${tt.ink}">${k}</text>`; }).join('') + `<text x="30" y="80" font-size="14" fill="${t.ink}">多套设计系统（各不相同）</text></svg>`;
}

// 交付物卡（问题定义 / 方案验收）
function kv(pairs) { return pairs.map(([k, v]) => `- ${k}：${v}`).join('\n'); }
// 难度 → 星级（与第一部分标记体系一致：入门★☆☆ / 进阶★★☆ / 高阶★★★）
function stars(difficulty) { return ({ '入门': '★☆☆', '进阶': '★★☆', '高阶': '★★★' })[difficulty] || '★★☆'; }
// 真实验收判定（替代硬编码 PASS）：逐项核对必含要素是否齐备，不齐则如实列出缺口。
function acceptance(c, d) {
  const checks = [
    ['指标链为真实计算值', Array.isArray(d.kpis) && d.kpis.length >= (c.metricChain || []).length && d.kpis.every((k) => Number.isFinite(k.value))],
    ['行业字段回到数据', (c.fields || []).length > 0],
    ['异常状态可追踪', (c.exceptionStates || []).length > 0],
    ['Skill 齐备', (c.skills || []).length >= 1],
  ];
  const gaps = checks.filter((x) => !x[1]).map((x) => x[0]);
  return gaps.length === 0
    ? `**决策动作**：${c.decisionAction}\n\n**PASS** — 指标链 ${d.kpis.length} 项均为回到 \`${c.dataset}\` 的实际计算值（${dkLabel(c)}）；字段/异常/Skill 齐备；可运行原型见 \`#/case/${pad(c.num)}\`（设计 ${c.design}），截图 \`assets/screenshots/premium_case_${pad(c.num)}_${c.slug}_desktop.png\`。`
    : `**待补** — 未满足：${gaps.join('、')}。补齐后重验，不通过不发布。`;
}
function deliverableMd(c, d, type) {
  const head = `# ${c.deliverable}（实操 ${pad(c.num)}·${type}）\n\n> 数据来源：\`${c.dataset}\`（${d.rowCount} 行，异常 ${d.exceptionCount}）。字段与指标均回到该数据。演示原理 ${(c.demonstrates || []).join('、')}，采用设计 ${c.design}。\n`;
  if (type === '问题定义')
    return head + `
## 产品问题\n\n${c.story}\n\n## 岗位与业务对象\n\n${kv([['岗位', c.role], ['业务对象', c.scenario], ['行业', c.industry]])}\n\n## 指标链（${dkLabel(c)}）\n\n${d.kpis.map((k) => `- ${k.name}：${k.value}${k.unit || ''}`).join('\n')}\n\n## 异常状态与责任\n\n${d.queue.slice(0, 6).map((q) => `- [${q.state}] ${Object.values(q.fields).slice(0, 3).join(' / ')} → 责任 ${q.owner}`).join('\n')}\n\n## 决策动作\n\n${c.decisionAction}\n\n## 风险边界\n\n${c.riskBoundary}${c.highImpact ? '（高影响行业：保留人工复核，不得自动决策）' : ''}\n\n## 使用 Skill\n\n${c.skills.join('、')}\n`;
  return head + `\n## 交付物\n\n${c.deliverable}\n\n## 验收清单\n\n${kv([['必含字段', c.fields.join('、')], ['必含指标链', c.metricChain.join('、')], ['必含异常状态', c.exceptionStates.join('、')], ['必含 Skill', c.skills.join('、')]])}\n\n## 合格标准\n\n业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。\n\n## 不合格标准\n\n使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「${c.riskBoundary}」。\n\n## 验收结论\n\n${acceptance(c, d)}\n`;
}

// 构建契约式 Prompt（工具无关，以 CodeBuddy 为主的任一 Agent 工具）
// Prompt 1（问题定义）与 Prompt 2（方案验收）职责不同、内容差异化，不再是同一段换两个字。
function buildPrompt(c, d, stage) {
  const head = '请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）';
  
const dataLine = `- 数据：读取 \`${c.dataset}\`，只使用其中实际存在的字段（${c.fields.join('、')}）。`;
  const kpiLine = `- 指标链：${c.metricChain.join('、')}（当前真实值：${d.kpis.map((k) => k.name + '=' + k.value + (k.unit || '')).join('，')}）。`;
  if (stage === 'def') {
    // 第一步：想清楚问题，不写代码——聚焦岗位/指标/异常/决策动作/边界。
    return `${head}完成「${c.scenario}」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：${c.role} 面向「${c.scenario}」，把业务判断转成一份可验证的产品问题定义。
${dataLine}
${kpiLine}
- 现场异常：要盯的是 ${c.exceptionStates.join('、')}——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——${c.decisionAction}
- 使用 Skill：用 ${c.skills[0]}、${c.skills[1]} 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：${c.deliverable}，保存为 \`outputs/product_case_library/case_${pad(c.num)}_${c.slug}_问题定义.md\`。
- 边界：结论必须回到数据或公开参考（${c.publicRef}）；不得越过「${c.riskBoundary}」${c.highImpact ? '；高影响行业保留人工复核' : ''}。`;
  }
  // 第二步：把定义做成可运行原型并逐项验收——聚焦技术契约/UI/ALL GREEN。
  return `${head}完成「${c.scenario}」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
${dataLine}
${kpiLine}
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 \`code/web\`（Vite+React+TS）路由 \`#/case/${pad(c.num)}\`，按 \`${c.uiId}\`（${c.saasType}）与设计 \`${c.design}\` 渲染；数据经 \`build_case_data.mjs\` 预计算，不得复用通用表格占位。
- 使用 Skill：用 ${c.skills[2]} 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：${c.deliverable}，保存为 \`outputs/product_case_library/case_${pad(c.num)}_${c.slug}_方案验收.md\`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「${c.riskBoundary}」${c.highImpact ? '；高影响行业保留人工复核' : ''}；\`node code/tools/verify_course_package.mjs\` 必须 ALL GREEN。`;
}

// SDD 系统建造八步 prompt 管线（旗舰案例 08 用）：不是「几个 prompt」，而是一条流水线——每步一个 prompt、产一份工件、喂下一步。工具无关。
function buildBuildPipeline() {
  return [
    ['① 宪法（constitution）', '请先读 `rules/`（DRY、单文件<800 行、类型安全、安全红线等不可谈判的约束），并声明：本次建造全程不得违反这些原则。它们是本系统的宪法。'],
    ['② 规格（spec）', '把「要建什么、为什么」写成 `spec.md`：目标、用户与场景、输入输出与数据、边界、前后置条件，以及一张约束表（业务/合规/规模/成本）。只写 what/why，不写实现。'],
    ['③ 澄清（clarify）', '把 `spec.md` 里所有模糊处标成 `[需澄清]`，逐条列出来问我确认——这一步我（人）必须在场逐条拍板，消除「意图债务」（§2.9），不许你替我猜。'],
    ['④ 架构设计（plan）', '基于确认后的规格产出 `plan.md`：C4 上下文/容器/组件图、DDD 限界上下文划分、以及关键技术选型的 ADR（背景→决策→后果，含重估信号）。'],
    ['⑤ 任务分解（tasks）', '把 `plan.md` 拆成 `tasks.md`：原子、可并行、可独立验收的小任务，每个标注依赖、验收条件与所属子系统。'],
    ['⑥ 实现（implement）', '逐个 task 跑一个 maker/checker Loop（§2）：builder 实现 → checker 跑全部检查 → 全绿才进下一个任务；接口契约即代码（OpenAPI 由 schema 自动生成，§3.4）。'],
    ['⑦ 门禁（analyze/gate）', '整体门禁：跨工件一致性检查 + evals + `verify` 三绿（§5）。任一红灯，回到对应步骤修复，不放行。这一步机器自动把关。'],
    ['⑧ 演进（evolve）', '上线后按「演进触发表」（§3.6）观察信号；一旦触发，回去改 `spec.md`（而非直接改代码），让规格始终是唯一真源。'],
  ];
}

// 数字化系统全景：纵向三层 × 横向数据价值闭环，全部案例作为节点串成一个系统
function panoramaSvg() {
  const N = defs.cases.length;
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
  <text x="50" y="42" font-size="22" font-weight="750" fill="${t.ink}">数字化系统全景 · ${N} 案例串成一个系统</text>
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
  s += `<text x="50" y="${H - 18}" font-size="10.5" fill="${t.muted}">底座平台（44 向量库 / 45 关系库 / 46 架构契约 / 51 SDD 建造 / 54 事件总线）支撑上层；业务应用按闭环各就各位——同一套数字化系统，${N} 案例是它不同环节的实操演示。</text></svg>`;
  return s;
}

// ============ 生成 SVG + 交付物 ============
writeFileSync(join(CLIB, 'svg', 'fig_system_panorama.svg'), panoramaSvg());
for (const id of ['fig_ai_foundations', 'fig_ideology_loops', 'fig_engineering_rules', 'fig_designs'])
  writeFileSync(join(CLIB, 'svg', `${id}.svg`), figSvg(id));
// v12 架构图套件（节点-连线引擎 diagram.mjs）：SDD 流水线 / C4 上下文·容器·组件 / DDD 限界上下文 / 部署 / 时序
for (const [id, svg] of Object.entries(archFigures(theme('graphite-hud')))) writeFileSync(join(CLIB, 'svg', `${id}.svg`), svg);
// 章节示意图套件（Phase A richness）：§2/§4/附录A/§5/§99 补图
for (const [id, svg] of Object.entries(chapterFigures(theme('graphite-hud')))) writeFileSync(join(CLIB, 'svg', `${id}.svg`), svg);
// 案例 06 真实子系统依赖图（数据来自 build_case_data 扫 import）
{ const d6 = vm(6); if (d6.deps?.length) writeFileSync(join(CLIB, 'svg', 'fig_case06_deps.svg'), subsystemDeps(d6.deps, d6.cycles || 0, theme('cyan-matrix'))); }
for (const c of defs.cases) {
  const d = vm(c.num);
  writeFileSync(join(CLIB, 'svg', `case_${pad(c.num)}_${c.slug}.svg`), svg(c, d));
  writeFileSync(join(CLIB, `case_${pad(c.num)}_${c.slug}_问题定义.md`), deliverableMd(c, d, '问题定义'));
  writeFileSync(join(CLIB, `case_${pad(c.num)}_${c.slug}_方案验收.md`), deliverableMd(c, d, '方案验收'));
}

// ============ 合成多文件教程（按章拆分，每文件可独立精修；重定位为「一个操作模型·三个角色镜头」）============
const src = (f) => readFileSync(join(ROOT, 'docs', '_source', f), 'utf8').trim();
const BOOK = 'AI时代研发产品项目一体化知识库';           // 教程目录名（替代旧单一 md）
const TITLE = '会自检的 AI 工程 · 实操手册';   // v16 单一定位：设计会自检的 Loop 系统
const BOOKDIR = join(ROOT, BOOK);
mkdirSync(join(BOOKDIR, '案例'), { recursive: true });
// —— 专业图标（Lucide，ISC）：从 vendored 内层路径重上色（语义/中性色，明暗主题都可见），构建到 assets/vendor/lucide/built/，行内 <img> 引用 ——
const ICON_COLOR = { 'check-circle': '#22c55e', 'book-open': '#38bdf8', 'sparkles': '#f59e0b', 'target': '#38bdf8', 'lightbulb': '#f59e0b', 'alert-triangle': '#f59e0b', 'gauge': '#94a3b8', 'rocket': '#38bdf8', 'book-marked': '#94a3b8', 'list-checks': '#22c55e', 'wrench': '#f97316', 'package': '#38bdf8', 'clipboard-list': '#a855f7', 'graduation-cap': '#38bdf8', 'trending-up': '#22c55e', 'flask-conical': '#94a3b8', 'compass': '#94a3b8', 'route': '#94a3b8' };
const ICONBUILT = join(ROOT, 'assets', 'vendor', 'lucide', 'built');
mkdirSync(ICONBUILT, { recursive: true });
for (const [name, col] of Object.entries(ICON_COLOR)) { const inner = loadIcon(name); if (!inner) { console.error('缺 Lucide 图标', name); continue; } writeFileSync(join(ICONBUILT, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`); }
let UP = '../';                                          // 教程文件到仓库根的相对前缀（章节/README/术语/结课=../；案例=../../）
const ic = (name) => `<img src="${UP}assets/vendor/lucide/built/${name}.svg" width="14" alt="" style="vertical-align:-2px" /> `;
const relink = (s) => s.replace(/\]\((outputs\/|assets\/|rules\/|skills\/|design\/|dataset\/|docs\/|README)/g, `](${UP}$1`).replace(/src="(outputs\/|assets\/)/g, `src="${UP}$1`);
// 源里的 emoji 标记/难度星 → 专业图标 + 文字（构建期统一替换，源保留 emoji 作语义 token，产物零 emoji）
const deemoji = (s) => s
  .replace(/★★★ (?=高阶)/g, '').replace(/★★☆ (?=进阶)/g, '').replace(/★☆☆ (?=入门)/g, '')
  .replace(/★★★/g, '高阶').replace(/★★☆/g, '进阶').replace(/★☆☆/g, '入门').replace(/[★☆]+/g, '')
  .replace(/🎯 ?/g, ic('target')).replace(/🟢 ?/g, ic('check-circle')).replace(/🔵 ?/g, ic('book-open'))
  .replace(/⭐ ?/g, ic('sparkles')).replace(/⚠️? ?/g, ic('alert-triangle')).replace(/💡 ?/g, ic('lightbulb'))
  .replace(/🧭 ?/g, ic('gauge')).replace(/🎚 ?/g, ic('gauge')).replace(/🚀 ?/g, ic('rocket'))
  .replace(/📚 ?/g, ic('book-marked')).replace(/📖 ?/g, ic('book-open')).replace(/🧪 ?/g, ic('flask-conical'))
  .replace(/📈 ?/g, ic('trending-up')).replace(/🧑‍[💼💻🔧] ?/g, '').replace(/🎮 ?/g, '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2B00}-\u{2BFF}\u{2600}-\u{26FF}]/gu, '');
const writeBook = (rel, content) => { const p = join(BOOKDIR, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content.replace(/\n{3,}/g, '\n\n').trim() + '\n'); };
const J = (a) => a.join('\n');

// —— README.md：总目录 + 导读（重定位 + 学习方法论） ——
UP = '../';
const readme = J([`# ${TITLE}`, '',
  `> **一个操作模型，三个角色镜头**——研发 · 产品 · 项目。真数据、可运行深色大屏原型、真截图、Node 自我校验护栏；数据真实/合成显式标注（[MANIFEST](${UP}dataset/MANIFEST.md)）、高影响行业保留人工复核。安装 / 目录 / 运行见 [项目 README](${UP}README.md)。`, '',
  '## 这本书讲什么', '',
  `> **一句话**：AI 时代，你不再手动做每件事，而是**设计一个能自动干活、还能自我检查的系统**。它三个零件——**Loop**（让 AI 循环干活的流水线）、**Skills**（把你的判断沉淀成可复用的技能包）、**验证 / evals**（拿一组测试题给 AI 打分，关键处再加人把关）。**本书只做这一个承诺：教你设计会自检的 Loop 系统**——不教提示词小技巧、不教求职、不按角色切三份；研发/产品/项目背景都能读（科普文风），但主线只有一条。全书用 ${defs.cases.length} 个真实案例演示、验证。`,
  '>',
  '> **前置**：会用浏览器和命令行即可，无需先懂 AI 或会写代码。',
  '>',
  `> **读完你能**：看懂 AI 产品/系统的底层概念，掌握「设计 Loop → 用 Skills → 靠验证把关」这套操作模型，并能把 ${defs.cases.length} 个真实行业案例跑起来、改起来。`, '',
  '### 统一操作模型（全书的脊柱）', '',
  '这套操作模型就叫 **Loop**：设计 Loop、给它 **Skills**、用 **验证/evals** 产出「差多少」的误差信号、在**高影响处让人把关**。§1 讲底层概念、§2 把这套 Loop 讲透——它对下面三个角色是同一副骨架。', '',
  '### 怎么真学会（不是看完就忘）', '',
  '> 本书用一套经认知科学验证的学习法组织内容——你只要跟着做，就在用它。',
  '',
  '- **知识 → 技能 → 智慧**：读章节 = 你「知道」；跟做案例 = 你「做到」；把方法用到自己真实项目 = 你「知道何时该做」。多数人停在「知道」，从没到「做到」——所以本书每章都配可运行的案例与练习。',
  '- **流利度 ≠ 存储强度**：看完能复述，不代表学会了，那只是短期记忆；不训练很快蒸发。这就是为什么本书逼你**合上书回忆、隔几天再看、几种案例交错练**。',
  '- 本书的练习不是摆设，是三种**「有效的费劲」**（认知科学 Robert Bjork「desirable difficulties」；开源实践见 Matt Pocock 的 `/teach` 技能，MIT；其检索自测已落为本书可用技能卡 self-quiz）：**巩固题=检索练习**（合书凭记忆写）、**章节前置链=间隔**、**入门线/底座支线=交错**。',
  '- **先写你的学习 MISSION**：别写「我想学好 AI」，写「学完后我能做 **Y**、改变 **Z**」（如「三个月内给我们产品的 AI 问答做一套 evals 上线」）。有了它，每章都能自问「这对我的 MISSION 有没有用」。', '',
  '### 怎么读这本书（标记体系）', '',
  '正文用三档标记，**新手只读必读也能走通全书，专业读者可循 选读 / 深度 直取深度**：', '',
  `- ${ic('check-circle')}**必读主线**：无论新手老手都该读，跳过会断链。`,
  `- ${ic('book-open')}**选读·进阶**：深一层的原理或动手扩展，新手可先跳过、日后回看。`,
  `- ${ic('sparkles')}**深度**：面向专业读者的权衡与延伸，不影响主线理解。`,
  '- **难度**：入门 / 进阶 / 高阶，标在每章每节与每个案例头部。',
  '- 每章以「学习目标」开头、「本章小结 + 练习」收尾；练习答案放在可折叠块里——先自己想，再展开。（体例例外：附录B 是速查表，只查不练，不设学习目标与练习。）',
  `- ${ic('book-marked')}**随时能查**：遇到不懂的词（Token / RAG / eval / 幻觉…），翻 [术语表](术语表.md)——一句话一个词。`, '',
  '### 学习路线图', '',
  '| 章节 | 前置 | 难度 | 预计 | 谁该重点看 |', '|---|---|---|---|---|',
  '| [§1 AI 核心概念底层](01-AI核心概念底层.md) | 无 | 入门 | 20min | **所有人必读**，尤其非技术背景 |',
  '| [§2 会 Loop 的工程](02-会Loop的工程.md) | §1 | 进阶 | 20min | 想懂 AI 开发模式的所有角色 |',
  '| [§3 系统架构设计（SDD 方法论）](03-系统架构设计.md) | §2 | 高阶 | 25min | **想真建中大型系统的人**；含 SDD/C4/DDD |',
  '| [§4 工程规范与约束](04-工程规范与约束.md) | 无 | 进阶 | 15min | 研发镜头；想判断「代码好坏」的人 |',
  '| [§5 交付治理](05-交付治理.md) | §2 | 进阶 | 15min | 管上线/门禁/风险 |',
  '| [§6 Skill 工程化与治理](06-Skill工程化与治理.md) | §2·§5 | 进阶 | 18min | 管 Skill 版本/审核/分发 |',
  '| [§7 架构风格与模式](07-架构风格与模式.md) | §3·§5·§6 | 进阶 | 15min | 想把老架构词接上 AI 实例 |',
  '| [§8 DDD 深化](08-DDD深化.md) | §3 | 高阶 | 18min | 想在真代码里认 DDD 战术件 |',
  '| [§9 分布式与 AI 实现技术](09-分布式与AI实现技术.md) | §3·§6·§7 | 高阶 | 16min | 多 Agent/缓存/注入安全 |',
  '| [§10 架构师与 AI 协作](10-架构师与AI协作.md) | §2 | 进阶 | 12min | 带团队用 AI 的人 |',
  '| [附录A 设计系统](90-附录A-设计系统.md) | 无 | 选读 | 12min | 关注大屏/可视化再读 |',
  '| [附录B 工具生态速查](91-附录B-工具生态速查.md) | 无 | 选读 | 8min | 要落地具体工具时查 |',
  `| [第二部分 · ${defs.cases.length} 案例](案例/README.md) | 第一部分 | 入门→高阶 | 每例 ~15min | 所有人，**边读边跑、动手验证** |`, '',
  `### ${ic('rocket')}10 分钟先跑通（先见成品，再学原理）`, '',
  '先花 10 分钟把成品跑起来，有了全局直觉再回来学原理：', '',
  '1. **环境**：Node ≥ 22（要用到实验性的 `node:sqlite`）。检查：`node -v`。',
  `2. **一条命令起服务**：\`bash code/run.sh\`（Fastify + node:sqlite，一个服务同时托管后端 API 与前端）。`,
  '3. **你应看到**：终端打印 `… http://localhost:5200`；浏览器打开它 → 首页是「数字化系统全景」，点任一节点进入案例。',
  '4. **先玩这三个**：`#/lab/tokenizer`（亲手把一句话分词）、`#/case/01`（电商早会经营台，最平缓的入门案例）、`#/game`（AI 概念配对小游戏）。', '',
  `> 跑不起来？环境要求（Node ≥ 22）与常见报错排查见 [项目 README](${UP}README.md)。`, '',
  '## 目录', '',
  '> 全书分两部分：第一部分是十章正文，按主题分四篇——**篇是主题分组，不是阅读顺序**，请按章号 §1→§10 顺序读（与上方路线图一致；篇二集中了 §3 与 §7-§9，读到 §7 前请先读完 §5-§6）；第二部分是案例。', '',
  '**篇一 · 转型与操作模型**', '',
  '- [§1 AI 核心概念底层](01-AI核心概念底层.md) · [§2 会 Loop 的工程](02-会Loop的工程.md)（全书脊柱：从写代码的人 → 设计会自检系统的人）',
  '', '**篇二 · 架构设计知识体系**（传统架构知识的 AI 时代重读）', '',
  '- [§3 系统架构设计（SDD 方法论）](03-系统架构设计.md) · [§7 架构风格与模式](07-架构风格与模式.md) · [§8 DDD 深化](08-DDD深化.md) · [§9 分布式与 AI 实现技术](09-分布式与AI实现技术.md)',
  '', '**篇三 · 工程与交付**', '',
  '- [§4 工程规范与约束](04-工程规范与约束.md) · [§5 交付治理](05-交付治理.md) · [§6 Skill 工程化与治理](06-Skill工程化与治理.md)',
  '', '**篇四 · 架构师与 AI 协作**', '',
  '- [§10 架构师与 AI 协作：软技能重读](10-架构师与AI协作.md)',
  '- 附录（选读）：[附录A 设计系统](90-附录A-设计系统.md) · [附录B 工具生态速查](91-附录B-工具生态速查.md)',
  '- [术语表](术语表.md)', '',
  `**第二部分 · ${defs.cases.length} 真实案例演示与验证**`, '',
  '- [案例总览 + 原理→案例反查](案例/README.md)',
  `- 编号说明：案例已于 v21 重编号为 01–${pad(defs.cases.length)}（旧号 30/41/44/45/46/49/51/54 依次对应 02–09）；旧↔新完整对照见 [README-cn](${UP}README-cn.md)。`,
  ...defs.cases.map((c) => `- [实操 ${pad(c.num)} · ${c.scenario}](案例/${pad(c.num)}-${c.slug}.md)`),
  '',
  '**收尾**', '', '- [结课 · 自查 · 下一步](99-结课.md)', '',
  '## 使用入口', '',
  `- **统一运行/纠错约定**：\`bash code/run.sh\` 起一个服务（Fastify+node:sqlite 托管 API+前端），浏览器 \`#/case/NN\` 即真后端实时数据；遵 \`rules/\`（DRY / 单文件<800 行 / 类型 / 中文注释），\`verify_course_package.mjs\` 逐项核验。`,
  `- **目录结构、构建/运行、环境要求与常见报错排查**：见 [项目 README](${UP}README.md) / [README-cn](${UP}README-cn.md)。`,
]);
writeBook('README.md', readme);

// —— 五章正文（源在 docs/_source，图标/内容/去AI化在源里改；此处只按 UP 重定相对路径） ——
UP = '../';
const CHAPTERS = [['00-ai-foundations.md', '01-AI核心概念底层.md'], ['01-ideology.md', '02-会Loop的工程.md'], ['02-architecture.md', '03-系统架构设计.md'], ['03-engineering.md', '04-工程规范与约束.md'], ['05-delivery.md', '05-交付治理.md'], ['06-skill-governance.md', '06-Skill工程化与治理.md'], ['08-arch-styles.md', '07-架构风格与模式.md'], ['09-ddd-deep.md', '08-DDD深化.md'], ['10-distributed-ai.md', '09-分布式与AI实现技术.md'], ['11-softskills.md', '10-架构师与AI协作.md'], ['04-designs.md', '90-附录A-设计系统.md'], ['07-tool-ecosystem.md', '91-附录B-工具生态速查.md']];
// 口径派生化（v16 ②修硬伤）：源文件写 {{CASE_COUNT}}/{{SKILL_COUNT}} 占位符，build 时替换为唯一事实源实值——数字口径不再可能漂移
const SKILL_N = (readFileSync(join(ROOT, 'skills', 'pm_skills.md'), 'utf8').match(/^## /gm) || []).length;
const derive = (t) => t.replaceAll('{{CASE_COUNT}}', String(defs.cases.length)).replaceAll('{{SKILL_COUNT}}', String(SKILL_N));
for (const [s, out] of CHAPTERS) writeBook(out, derive(deemoji(relink(src(s)))));
writeBook('99-结课.md', derive(deemoji(relink(src('99-capstone.md')))));

// —— 术语表 ——
UP = '../';
writeBook('术语表.md', J(['# 术语表（先备着，看案例时随时回查）', '',
  '| 术语 | 一句话 |', '|---|---|',
  '| Token | 大模型处理文本的最小计量单位；1 Token≈1.5~2 汉字（§1.2） |',
  '| Context / 上下文窗口 | 单次运算的全部输入 / 其最大 Token 容量（§1.3） |',
  '| RAG | 检索增强生成：分片→索引→召回→重排→生成，只喂高相关片段（§1.3） |',
  '| Embedding / 向量库 | 把文本转成向量 / 存向量+原文、按相似度检索（§1.3、案例04） |',
  '| Agent / ReAct | 自主分步的智能体 / 思考→调用工具→观察→再思考的循环（§1.6） |',
  '| Tool / MCP | 模型可调用的函数 / 一套通用的工具接入标准（§1.5） |',
  '| 幂等 | 同一写操作重复执行，结果不变（如重发一次不会多下一单，§3.4） |',
  '| DRY / 单一职责 | 同一知识只表示一次 / 一个模块只有一个改变它的理由（§4.1、§4.2） |',
  '| YAGNI | You Aren’t Gonna Need It：没真需要就先别造（§4，反过度工程） |',
  '| RFM | 用最近消费 R、频次 F、金额 M 给客户分层的经典方法（案例 02） |',
  '| Cross-Encoder / 重排 | RAG 里粗召回后再精排相关片段的第二阶段（§1.3、案例 04） |',
  '| Design Token | 把颜色/字号/圆角等最小设计决策抽成变量单一来源（附录A） |',
  '| systemLayer / systemStage | 案例在数字化系统的「层（底座/能力/应用）/ 环节（采集→…→增长）」 |',
  '| metricSpec | 案例指标的真实列计算规格（保证 KPI 真算、可溯源、非编造） |',
  '| eval / 评测 | 用离线测试集 + 打分器量化「AI 回答好不好」，是 AI 产品的验收标尺（§2 传感器） |',
  '| 幻觉 / hallucination | 模型一本正经地编造不实内容；RAG、评测、人工复核都是为压住它（§1.3、案例 04） |',
  '| context rot / 上下文腐烂 | 上下文太长、关键信息在中间时模型「读不到」，长上下文性能衰减（§1.3） |',
  '| harness / 脚手架 | 把模型包成能自动「跑→验→改」的外壳（如本书的 `verify`），是 Loop 的骨架；业界 2026 年命名的 Harness Engineering 即其体系化（§2.2、§5） |',
  '| 控制论闭环 | 目标→执行→测偏差→反馈修正的循环；一个能自转的 Loop 就是一台控制系统（§2.3） |',
  '| critic / 对抗式红队 | 专挑毛病、只读不改码的探针（本书 `adversarial_review.mjs`），红队→分诊→修→再红队（§2.6） |',
  '| vibe coding | 只凭感觉让 AI 生成、不看评测与验收；本书反其道而行，强调 evals 与护栏（§2、§4） |',
  '| AI slop | 一眼看出是 AI 生成的廉价信号（套模板配色、卡片套卡片、套话）；附录A 反其道 |',
  '| SDD 规格驱动开发 | 宪法→规格→澄清→架构→任务→实现→门禁→演进 八步，规格=唯一真源；几个 prompt 建不成大系统的解法（§3.0，GitHub Spec Kit） |',
  '| C4 模型 | 架构四层缩放图：Context→Container→Component→Code（§3.3，Simon Brown） |',
  '| DDD / 限界上下文 | 领域驱动设计：按业务域把系统切成有独立通用语言的限界上下文（§3.3，Eric Evans） |',
  '| ADR | 架构决策记录：背景→决策→后果，把「为什么这样选」留痕（§3.5，Michael Nygard） |',
  '| 质量属性场景 | 把非功能需求写成「刺激→环境→响应→度量」的可量化场景（§3.2，SEI 风格） |',
  '| 规格漂移 | 代码越改越偏离规格意图；SDD 用阶段门禁 + CI 三绿来压住它（§3.0） |',
  '| 适应度函数 | 把架构边界写成能自动跑的断言，扫依赖检测越界/循环依赖（§3.3，案例 06） |',
  '| Skill Registry | Skill 的私有仓库：版本/审核/安全/分发；draft→review→online→offline（§6，Nacos 阿里巴巴） |',
  '| skill-scanner | 发布前扫 Skill 的提示注入/数据泄露/恶意代码，「不过则不发布」（§6，本书 skill_lint dogfood） |',
  '| delta spec | 只记录「这次变更了什么」的增量规格，不重写整篇；brownfield 友好（§6/§3，OpenSpec Fission-AI） |',
  '| 教员式/保姆式技能 | 技能生态第二根轴：教员式拷问你与教基本功（grill/tdd），保姆式接管流程（GSD/Spec Kit）；本书立场=流程可保姆、判断必教员（§2.6） |',
  '| Ralph 循环 | 把 Agent 包在 while 循环里、规格/验证都在 agent 之外，靠持续迭代跑完任务（§2.6，Geoffrey Huntley；本书 self-evolve 即一例） |',
  '| 通用语言 / Ubiquitous Language | 业务、代码、文档说同一套话；词链断裂处就是 Agent 猜错处（§8.1，DDD） |',
  '| 聚合根 | 一组必须一起保持一致的对象的唯一入口，改子对象必须经根；不变量由守卫机器化（§8.2） |',
  '| 领域事件 / 事件驱动 | 事件=已发生的事实（过去时命名）；发布者宣布「发生了什么」、不关心谁在听（§7.2、§8.3，案例 09） |',
  '| 事件溯源 / Event Sourcing | 状态不直接存，从不可变事件流重放推导出来（§9.4，案例 09） |',
  '| 防腐层 / ACL | 上下文边界上的翻译官：外部模型先翻译成本域通用语言再进门（§7.3、§8.4） |',
  '| 提示注入 / prompt injection | 把指令藏进数据让 Agent 误当命令执行——AI 时代的 SQL 注入（§6.3、§9.3） |',
  '', `> **进一步阅读**：各章规范与概念的权威出处汇总在 [rules/references.md](${UP}rules/references.md)；Loop 工程的可复用实操文件见 [skills/loop_engineering/](${UP}skills/loop_engineering)。`]));

// —— 案例/README.md：全景 + 总览 + 原理反查 ——
UP = '../../';
const idxH = ['# 第二部分 · 案例演示与验证', '', '## 数字化系统全景（先看这张图）', '',
  `第一部分讲的理念、原理、规范、设计，不是散点——它们共同构成**一套数字化系统**。下面 ${defs.cases.length} 个代表性案例，正是这套系统在不同环节、不同层的**实操演示**（每案标注它更偏哪个角色镜头）：`, '',
  `![数字化系统全景](${UP}outputs/product_case_library/svg/fig_system_panorama.svg)`, '',
  '- **纵向三层**：`底座平台`（44 向量库·45 关系库·46 架构契约·51 SDD 建造·54 事件总线）→ `能力智能`（指标/检索/AI）→ `业务应用`（业务场景）。',
  '- **横向数据价值闭环**：`采集 → 治理 → 洞察 → 决策 → 执行 → 验收 → 增长`，再反馈回采集。',
  '- **怎么读**：先在全景里定位一个案例在「哪一层·哪一环节」，再进它看它把哪条理论落成了什么操作。', '',
  '## 案例总览', '',
  '| # | 场景 | 行业 | 角色镜头 | 演示原理 | 设计 | 链接 |', '|---|---|---|---|---|---|---|'];
for (const c of defs.cases) idxH.push(`| ${pad(c.num)} | ${c.scenario} | ${c.industry} | ${(c.lenses || []).join('/')} | ${(c.demonstrates || []).join('/')} | ${c.design} | [打开](${pad(c.num)}-${c.slug}.md) |`);
{ const revMap = {};
  for (const c of defs.cases) for (const op of (c.demonstrates || [])) (revMap[op] = revMap[op] || []).push(c.num);
  const rows = Object.entries(revMap).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  idxH.push('', '## 原理 → 案例 反查（哪个原理，被哪些案例演示）', '',
    '> 读完第一部分某个原理，想看它怎么落地？按这张表直达（自动从各案 `demonstrates` 反转，只列被真实演示到的原理）。', '',
    '| 原理 | 演示它的案例 |', '|---|---|');
  for (const [op, nums] of rows) idxH.push(`| §${op} | ${nums.map((n) => `[案例 ${pad(n)}](${pad(n)}-${defs.cases.find((x) => x.num === n).slug}.md)`).join('、')} |`); }
writeBook('案例/README.md', J(idxH));

// —— 每案一文件（图标 + 相对路径 + 角色镜头） ——
UP = '../../';
const LENS_ICON = { 研发: 'wrench', 产品: 'package', 项目: 'clipboard-list' };
const lensTags = (c) => (c.lenses || []).map((l) => ic(LENS_ICON[l]) + l).join(' · ');
const lensViewLines = (c) => c.lensViews ? ['### 三镜头看同一个案例', '', '> 同一份真实数据、同一个案例，研发/产品/项目三种角色各看到什么——这就是「一个操作模型、三个镜头」。', '', ...Object.entries(c.lensViews).map(([l, v]) => `- ${ic(LENS_ICON[l])}**${l}镜头**：${v}`), ''] : [];
for (const c of defs.cases) {
  const d = vm(c.num);
  const B = [`# 实操 ${pad(c.num)}：${c.title}`, '',
    `### 项目场景故事`, '', dkNote(c) + c.story, '',
    `> **本案例演示/验证**：原理 ${(c.demonstrates || []).join('、')}｜**采用设计** \`${c.design}\`（见 [design/${c.design}.md](${UP}design/${c.design}.md)）`, '',
    `> **在数字化系统中的位置**：${c.systemLayer}层 · ${c.systemStage}环节｜**理论→实操**：${c.theoryOp}`, '',
    `> **角色镜头**：${lensTags(c)}（本案更偏这些角色；主脊 §1-§2 三镜头共读）`, '',
    ...(c.num === 8 ? [`> **方法论落点**：单个案例 = SDD 流水线（§3.0）上一个可验收的小任务；一个中大型系统 = 许多这样的任务按方法论编排起来。`, ''] : []),
    `> ${ic('gauge')}**难度** ${c.difficulty}｜**一句话** ${c.tldr}｜**前置** 建议先读完第一部分`,
    '>',
    `> ${ic('lightbulb')}**洞见**：${c.insight}`,
    '>',
    `> ${ic('alert-triangle')}**常见坑**：${c.pitfall}`, '',
    ...lensViewLines(c),
    `**现状问题**`, '', `- 决策依赖的关键指标：${c.metricChain.join('、')}。`, `- 现场常见异常：${c.exceptionStates.join('、')}。`, `- 只做通用页面无法支撑「${c.decisionAction}」。`, '',
    `**本次任务**`, '', `- 明确岗位、指标链、异常状态与决策动作。`, `- 使用 \`${c.skills[0]}\` 与 \`${c.skills[1]}\` 完成分析，产出 \`${c.deliverable}\`，用 \`${c.skills[2]}\` 验收。`, '',
    `### 任务目标与数据`, '', kv([['行业', c.industry], ['真实业务场景', c.scenario], ['岗位', c.role], ['数据或资料', '`' + c.dataset + '`（' + d.rowCount + ' 行，异常 ' + d.exceptionCount + '）'], ['公开参考', c.publicRef], ['行业字段', c.fields.join('、')], ['指标链（' + dkLabel(c) + '）', d.kpis.map((k) => k.name + ' ' + k.value + (k.unit || '')).join('，')], ['决策动作', c.decisionAction], ['风险边界', c.riskBoundary + (c.highImpact ? '（高影响行业·人工复核）' : '')], ['UI 原型', '`' + c.uiId + '`（' + c.saasType + '）'], ['采用设计', c.design], ['SaaS 组件', c.saasComponents.join('、')]]), '',
    ...(c.screen === 'buildwalk'
      ? ['### Prompt 实操 · SDD 系统建造八步（多 prompt 编排）', '', '> 正面回答「几个 prompt 建不成系统」：下面是一条**流水线**——每步一个 prompt、产一份工件、喂给下一步；澄清与门禁是人/机把关。照着走，才建得动一个中大型系统。', '', '> **怎么用（用 CodeBuddy 跑这套「建系统」走查）**：整条流水线正好对上 CodeBuddy 的模式——宪法/规格/澄清用 **Ask + Plan**（问清楚、让它列任务清单）；架构与任务分解用 **Plan**；逐任务实现用 **Craft**（多文件生成/重构/测试）；门禁三绿用 **Craft** 跑测试 + review；演进则回改规格再进 **Plan**。把每步代码框整段贴进对应模式、拿到工件再喂下一步；海外读者换 Claude Code / Cursor 同理（见附录B）。', '',
        ...buildBuildPipeline().flatMap(([s, p]) => [`**${s}**`, '', '```text', p, '```', ''])]
      : ['### Prompt 实操', '', '> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见附录B）。', '', `**Prompt 1：${c.scenario} - 问题定义**`, '', '```text', buildPrompt(c, d, 'def'), '```', '', `**Prompt 2：${c.scenario} - 方案验收**（注意：outputs/ 交付物由 build_docs 重建覆盖，建议在新分支/对照目录运行）`, '', '```text', buildPrompt(c, d, 'accept'), '```', '']),
    `### 图形/原型/表单`, '', `![${c.scenario} · 信息图](${UP}outputs/product_case_library/svg/case_${pad(c.num)}_${c.slug}.svg)`, '',
    ...(c.num === 6 && d.deps?.length ? [`![案例06 · 后端子系统真实依赖（C4 · dogfood）](${UP}outputs/product_case_library/svg/fig_case06_deps.svg)`, ''] : []),
    ...(c.num === 2 ? [`![案例02 · 真实客户 vs 教学合成 R×F 双散点](${UP}outputs/product_case_library/svg/fig_rfm_dual.svg)`, ''] : []),
    `![${c.scenario} · 可运行大屏原型截图](${UP}assets/screenshots/premium_case_${pad(c.num)}_${c.slug}_desktop.png)`, '',
    `- 图形类型：${c.slug}（设计 ${c.design}）`, `- 看图顺序：${c.readingOrder || '先看指标链，再看异常队列和责任对象，最后看行动入口与验收边界。'}`, `- UI 差异：本案例采用 \`${c.uiId}\` + 设计 \`${c.design}\`，不得复用通用表格占位；可运行原型见 \`#/case/${pad(c.num)}\`。`, '',
    `### 交付物与验收`, '', `交付物：**${c.deliverable}**。必含要素（字段/指标链/异常状态/Skill/决策动作/高影响复核）与合格线由自测器六项核对：\`node code/tools/check_my_work.mjs ${c.num} 你的方案.md\`；红线：不越过「${c.riskBoundary}」。`, ''];
  if (c.rp) B.push(`**指定实操融合**`, '', `- ${c.rp.id}：${c.rp.title}`, `  - 产出：${c.rp.produce}`, `  - 验收：${c.rp.accept}`, '');
  B.push(`### 跟着做（动手复现）`, '', `1. 起服务：\`bash code/run.sh\`，浏览器打开 \`#/case/${pad(c.num)}\`（本案专属大屏）。`, `2. **你应看到**：${({rag:'检索框+召回/重排两列结果与相似度',db:'SQL 语句、执行结果表与索引说明',arch:'后端子系统依赖图（真扫 import）与 ADR/契约卡',eval:'金标题目命中/未命中队列与覆盖图',buildwalk:'SDD 八步走查队列与门禁状态',rfm:'教学合成横幅、分层散点与分层队列'})[c.screen] || `指标链（${c.metricChain.slice(0, 2).join(' / ')} …）、异常队列与行动入口`}，数据来自后端实时接口（性质见章首标注）。`, `3. **动手改一改**：${c.tryThis || '换一个维度或筛选，观察指标怎么变；再点页面里的「决策题挑战」做一次判断。'}`, `4. **自测产出**：\`node code/tools/check_my_work.mjs ${c.num} 你的方案.md\`——红项指明缺什么、回哪章补。`, '');
  if (c.deepDive) B.push('<details>', `<summary>${ic('sparkles')}深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>`, '', c.deepDive, '</details>', '');
  if (c.exercises && c.exercises.length) {
    B.push(`### 练习（做完再进下一个案例）`, '', c.exercises.map((e, i) => `${i + 1}. **${e.type}**：${e.q}`).join('\n'), '');
    // 参考思路：defs 无标准答案字段——给可核对的自检路径而非编造答案（对齐 README「答案放可折叠块」体例）
    B.push('<details>', '<summary>参考思路（先自己想，再展开）</summary>', '',
      `- 这两题没有唯一标准答案，检验的是你能否把本案方法用自己的话讲出来：先按「跟着做」第 3 步真改一次、看指标怎么动，再对照${c.deepDive ? '上方「深度」折叠块的权衡与失效模式' : '本案「洞见」与「常见坑」'}自评你的答案有没有踩坑。`,
      `- 答不顺就回读本案演示的原理小节 ${(c.demonstrates || []).map((x) => `§${x}`).join('、')}；写成方案后跑 \`node code/tools/check_my_work.mjs ${c.num} 你的方案.md\`，红项会指明缺什么、回哪章补。`,
      '</details>', '');
  }
  B.push(`> **小结**：本案用「${c.scenario}」演示原理 ${(c.demonstrates || []).join('、')}，落成可运行、可验收的产品判断。运行 \`bash code/run.sh\` 后访问 \`#/case/${pad(c.num)}\`（真后端实时数据）。`, '', `[← 返回案例总览](README.md) · [返回目录](${UP}${BOOK}/README.md)`);
  writeBook(`案例/${pad(c.num)}-${c.slug}.md`, deemoji(J(B)));
}
console.log('多文件教程生成完毕：', BOOK, '| 章', CHAPTERS.length, '+ 案例', defs.cases.length, '+ README/术语表/结课 | figs 4');
