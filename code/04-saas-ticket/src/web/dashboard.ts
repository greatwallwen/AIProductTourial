/**
 * 内嵌 HTML 看板：单路由返回、零外部资源、原生 JS 轮询只读接口 /api/tickets，
 * 按状态分列（open / in_progress / resolved / closed）渲染工单板。
 *
 * dashboardHtml 是「函数」而非常量：工单接口挂在鉴权子作用域，需带 X-API-Key。
 * 本地演示把某个租户的开发种子 Key 烤进页面（见 app.ts 的注释警示）。
 * 注意：内部 JS 一律用字符串拼接而非模板字符串，避免与本 TS 模板字符串的 ${} 冲突；
 * 唯一的 ${...} 是把 Key 以 JSON 字面量安全注入页面的那处 TS 级插值。
 * 无障碍：优先级永远「符号 + 文字」成对出现，颜色只作辅助，不单独表意。
 */
export function dashboardHtml(apiKey: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>工单看板 · 租户 SUPABASE（本地演示）</title>
<style>
  :root {
    --page: #0d0d0d; --card: #1a1a19; --line: #2c2c2a;
    --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --good: #0ca30c; --warning: #fab219; --critical: #d03b3b; --info: #4a9bd4;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink-2);
         font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; }
  header { display: flex; justify-content: space-between; align-items: baseline;
           padding: 18px 28px; border-bottom: 1px solid var(--line); }
  header h1 { margin: 0; font-size: 18px; font-weight: 600; color: var(--ink); }
  header .sub { font-size: 12px; color: var(--muted); }
  main { padding: 20px 28px 40px; max-width: 1400px; margin: 0 auto; }
  .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .col { background: transparent; }
  .col h2 { font-size: 13px; font-weight: 600; color: var(--muted); letter-spacing: .06em;
            margin: 0 0 10px; display: flex; align-items: baseline; gap: 8px; }
  .col h2 .count { color: var(--ink-2); font-weight: 600; }
  .col .stack { display: flex; flex-direction: column; gap: 8px; }
  .ticket { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .ticket.p-high { border-color: var(--critical); }
  .ticket .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .ticket .no { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .ticket .title { color: var(--ink); font-size: 14px; font-weight: 600; margin-top: 6px; }
  .ticket .meta { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .badge { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
  .badge.good     { color: var(--good);     border: 1px solid var(--good); }
  .badge.warning  { color: var(--warning);  border: 1px solid var(--warning); }
  .badge.critical { color: var(--critical); border: 1px solid var(--critical); }
  .badge.info     { color: var(--info);     border: 1px solid var(--info); }
  .badge.neutral  { color: var(--ink-2);    border: 1px solid var(--line); }
  .empty { color: var(--muted); font-size: 13px; padding: 8px 2px; }
</style>
</head>
<body>
<header>
  <h1>工单看板 · 租户 SUPABASE（本地演示）</h1>
  <span class="sub" id="updated">加载中…</span>
</header>
<main>
  <div class="board" id="board"></div>
</main>
<script>
  var API_KEY = ${JSON.stringify(apiKey)};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }

  // 状态列定义（顺序即看板列顺序）
  var COLUMNS = [
    { key: 'open',        label: '待处理',  sym: '○' },
    { key: 'in_progress', label: '处理中',  sym: '◐' },
    { key: 'resolved',    label: '已解决',  sym: '✓' },
    { key: 'closed',      label: '已关闭',  sym: '◆' }
  ];

  // 优先级永远「符号 + 文字」成对出现，颜色只作辅助
  var PRIORITY = {
    high:   { sym: '▲', text: '高', cls: 'critical' },
    medium: { sym: '●', text: '中', cls: 'warning' },
    low:    { sym: '▽', text: '低', cls: 'good' }
  };
  function priorityBadge(p) {
    var d = PRIORITY[p] || { sym: '·', text: p, cls: 'neutral' };
    return '<span class="badge ' + d.cls + '">' + d.sym + ' ' + esc(d.text) + '</span>';
  }
  function ymd(iso) { return iso ? esc(String(iso).slice(0, 10)) : '—'; }

  function ticketCard(t) {
    return '<div class="ticket p-' + esc(t.priority) + '">' +
      '<div class="top">' + priorityBadge(t.priority) +
        '<span class="no">' + esc(t.ticketNo) + '</span></div>' +
      '<div class="title">' + esc(t.title) + '</div>' +
      '<div class="meta">经办：' + esc(t.assignee || '未分配') + ' · 更新 ' + ymd(t.updatedAt) + '</div>' +
    '</div>';
  }

  function render(tickets) {
    var byStatus = { open: [], in_progress: [], resolved: [], closed: [] };
    tickets.forEach(function (t) { (byStatus[t.status] || (byStatus[t.status] = [])).push(t); });
    document.getElementById('board').innerHTML = COLUMNS.map(function (col) {
      var list = byStatus[col.key] || [];
      var body = list.length
        ? list.map(ticketCard).join('')
        : '<div class="empty">无工单</div>';
      return '<div class="col">' +
        '<h2>' + col.sym + ' ' + esc(col.label) + ' <span class="count">' + list.length + '</span></h2>' +
        '<div class="stack">' + body + '</div>' +
      '</div>';
    }).join('');
  }

  async function refresh() {
    try {
      var res = await fetch('/api/tickets', { headers: { 'X-API-Key': API_KEY } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var tickets = await res.json();
      render(tickets);
      document.getElementById('updated').textContent =
        '共 ' + tickets.length + ' 单 · 每 5 秒自动刷新 · 更新于 ' + new Date().toLocaleTimeString('zh-CN');
    } catch (e) {
      document.getElementById('updated').textContent = '刷新失败：' + e;
    }
  }
  refresh();
  setInterval(refresh, 5000);
</script>
</body>
</html>
`;
}
