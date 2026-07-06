/** 节点-连线架构图渲染器（深色大屏风）：C4 / 限界上下文 / 部署 / 数据流 / SDD 流水线 / 时序。
 *  坐标显式给定 → 确定性、截图稳定。t = 主题对象（bg/bg2/panel/panelSoft/border/grid/ink/ink2/muted/accent/accent2/ok/warn/bad）。
 *  build_docs 已接近 800 行，故图形引擎独立成模块（对齐 rules 单文件<800）。*/
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function frame(W, H, t, title, caption) {
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="PingFang SC,Microsoft YaHei,sans-serif">
  <defs>
    <linearGradient id="dbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
    <linearGradient id="dac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
    <pattern id="dgrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern>
    <filter id="dsh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000" flood-opacity="0.35"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#dbg)"/><rect width="${W}" height="${H}" fill="url(#dgrid)" opacity="0.35"/>
  <rect x="0" y="0" width="${W}" height="44" fill="${t.panel}" opacity="0.5"/>
  <rect x="24" y="13" width="4" height="19" rx="2" fill="url(#dac)"/>
  <text x="36" y="28" font-size="15" font-weight="750" fill="${t.ink}">${esc(title)}</text>`;
  const foot = `${caption ? `<text x="24" y="${H - 14}" font-size="10.5" fill="${t.muted}">${esc(caption)}</text>` : ''}\n</svg>`;
  return { head, foot };
}

function nodeSvg(n, t) {
  const col = n.color || t.accent;
  const cx = n.x + n.w / 2;
  const tag = n.tag ? `<rect x="${n.x + n.w - esc(n.tag).length * 7 - 16}" y="${n.y + 6}" width="${esc(n.tag).length * 7 + 10}" height="15" rx="7" fill="${col}" opacity="0.18"/><text x="${n.x + n.w - 10}" y="${n.y + 17}" font-size="8.5" fill="${col}" text-anchor="end">${esc(n.tag)}</text>` : '';
  const sub = n.sub ? `<text x="${cx}" y="${n.y + n.h / 2 + 14}" font-size="9.5" fill="${t.muted}" text-anchor="middle">${esc(n.sub)}</text>` : '';
  const ly = n.sub ? n.y + n.h / 2 - 1 : n.y + n.h / 2 + 4;
  return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10" fill="${t.panel}" stroke="${col}" stroke-width="1.4" ${n.dashed ? 'stroke-dasharray="5 3"' : ''} filter="url(#dsh)"/>
  <rect x="${n.x}" y="${n.y}" width="${n.w}" height="3" rx="1.5" fill="${col}"/>${tag}
  <text x="${cx}" y="${ly}" font-size="12" font-weight="700" fill="${t.ink}" text-anchor="middle">${esc(n.label)}</text>${sub}`;
}

function edgeSvg(e, N, t) {
  const a = N[e.from], b = N[e.to];
  if (!a || !b) return '';
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x, dy = bc.y - ac.y;
  let p1, p2;
  if (Math.abs(dx) >= Math.abs(dy)) { p1 = { x: dx >= 0 ? a.x + a.w : a.x, y: ac.y }; p2 = { x: dx >= 0 ? b.x : b.x + b.w, y: bc.y }; }
  else { p1 = { x: ac.x, y: dy >= 0 ? a.y + a.h : a.y }; p2 = { x: bc.x, y: dy >= 0 ? b.y : b.y + b.h }; }
  const col = e.color || t.accent2;
  const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x), s = 7.5;
  const head = (x, y) => `<path d="M${x} ${y} L${(x - s * Math.cos(ang - 0.5)).toFixed(1)} ${(y - s * Math.sin(ang - 0.5)).toFixed(1)} L${(x - s * Math.cos(ang + 0.5)).toFixed(1)} ${(y - s * Math.sin(ang + 0.5)).toFixed(1)} z" fill="${col}"/>`;
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const lbl = e.label ? `<rect x="${(mx - esc(e.label).length * 3.3 - 5).toFixed(1)}" y="${my - 8}" width="${esc(e.label).length * 6.6 + 10}" height="15" rx="4" fill="${t.bg2}" stroke="${t.border}"/><text x="${mx}" y="${my + 3}" font-size="9" fill="${t.ink2}" text-anchor="middle">${esc(e.label)}</text>` : '';
  return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${col}" stroke-width="1.6" ${e.dashed ? 'stroke-dasharray="5 3"' : ''}/>${head(p2.x, p2.y)}${e.bidir ? head(p1.x, p1.y) : ''}${lbl}`;
}

function groupSvg(g, t) {
  const col = g.color || t.border;
  return `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12" fill="${col}" opacity="0.06"/><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12" fill="none" stroke="${col}" stroke-opacity="0.45" ${g.dashed ? 'stroke-dasharray="6 4"' : ''}/><text x="${g.x + 12}" y="${g.y + 18}" font-size="11" font-weight="650" fill="${col}">${esc(g.label)}</text>`;
}

function legendSvg(legend, W, H, t) {
  if (!legend.length) return '';
  let x = W - 20;
  const items = legend.map((l) => { const w = esc(l.label).length * 6.6 + 26; x -= w + 8; return `<rect x="${x}" y="${H - 26}" width="12" height="12" rx="3" fill="${l.color}"/><text x="${x + 18}" y="${H - 16}" font-size="9.5" fill="${t.ink2}">${esc(l.label)}</text>`; }).reverse();
  return items.join('');
}

// 通用节点-连线图
export function diagram(spec, t) {
  const { W = 960, H = 560, title = '', caption = '', groups = [], nodes = [], edges = [], legend = [] } = spec;
  const N = {}; for (const n of nodes) N[n.id] = n;
  const { head, foot } = frame(W, H, t, title, caption);
  return head + groups.map((g) => groupSvg(g, t)).join('\n') + '\n' + edges.map((e) => edgeSvg(e, N, t)).join('\n') + '\n' + nodes.map((n) => nodeSvg(n, t)).join('\n') + '\n' + legendSvg(legend, W, H, t) + foot;
}

// 时序 / 数据流图：actors 为竖直生命线，messages 为横向带箭头消息（按 y 递增）
export function sequence(spec, t) {
  const { W = 960, H = 520, title = '', caption = '', actors = [], messages = [] } = spec;
  const { head, foot } = frame(W, H, t, title, caption);
  const top = 60, bottom = H - 46;
  const A = {}; for (const a of actors) A[a.id] = a;
  const lanes = actors.map((a) => `<line x1="${a.x}" y1="${top + 30}" x2="${a.x}" y2="${bottom}" stroke="${t.grid}" stroke-dasharray="3 4"/>
  <rect x="${a.x - a.w / 2}" y="${top}" width="${a.w}" height="30" rx="8" fill="${t.panel}" stroke="${a.color || t.accent}" stroke-width="1.3"/><rect x="${a.x - a.w / 2}" y="${top}" width="${a.w}" height="3" rx="1.5" fill="${a.color || t.accent}"/>
  <text x="${a.x}" y="${top + 19}" font-size="11" font-weight="700" fill="${t.ink}" text-anchor="middle">${esc(a.label)}</text>`).join('\n');
  const msgs = messages.map((m) => {
    const a = A[m.from], b = A[m.to]; if (!a || !b) return '';
    const col = m.color || (m.ret ? t.muted : t.accent2);
    const dir = b.x >= a.x ? 1 : -1, s = 7;
    const head2 = `<path d="M${b.x} ${m.y} L${b.x - dir * s} ${m.y - 4} L${b.x - dir * s} ${m.y + 4} z" fill="${col}"/>`;
    return `<line x1="${a.x}" y1="${m.y}" x2="${b.x}" y2="${m.y}" stroke="${col}" stroke-width="1.5" ${m.ret ? 'stroke-dasharray="5 3"' : ''}/>${head2}
    <text x="${(a.x + b.x) / 2}" y="${m.y - 6}" font-size="9.5" fill="${t.ink2}" text-anchor="middle">${esc(m.label)}</text>`;
  }).join('\n');
  return head + lanes + '\n' + msgs + foot;
}
