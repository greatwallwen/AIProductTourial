/**
 * 内嵌 HTML 看板：单路由返回、零外部资源、原生 JS 轮询两个只读接口
 * （事项目录 /api/items 与 申报单列表 /api/applications）。
 * 注意：内部 JS 一律用字符串拼接而非模板字符串，避免与本 TS 模板字符串的 ${} 冲突。
 * 无障碍：状态永远「符号 + 文字」成对出现，颜色只作辅助，不单独表意。
 */
export const dashboardHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>政务事项申报审批看板</title>
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
  main { padding: 20px 28px 40px; max-width: 1280px; margin: 0 auto; }
  h2 { font-size: 13px; font-weight: 600; color: var(--muted); letter-spacing: .06em; margin: 24px 0 10px; }
  h2 .count { color: var(--ink-2); font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  .item { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .item .name { color: var(--ink); font-size: 15px; font-weight: 600; }
  .item .code { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .item .info { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .item .days { margin-top: 8px; display: flex; gap: 14px; }
  .item .days .n { color: var(--ink); font-weight: 650; font-variant-numeric: tabular-nums; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .app { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;
         background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
  .app.overdue { border-color: var(--critical); }
  .app .no { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .app .item-name { color: var(--ink-2); }
  .app .meta { font-size: 12px; color: var(--muted); }
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
  <h1>政务事项申报审批看板</h1>
  <span class="sub" id="updated">加载中…</span>
</header>
<main>
  <h2>事项目录 <span class="count" id="items-count"></span></h2>
  <div class="grid" id="items"></div>
  <h2>申报单 <span class="count" id="apps-count"></span></h2>
  <div class="list" id="apps"></div>
</main>
<script>
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }

  // 状态永远「符号 + 文字」成对出现，颜色只作辅助
  var STATUS = {
    submitted:    { sym: '○', text: '已提交',   cls: 'neutral' },
    accepted:     { sym: '◉', text: '已受理',   cls: 'info' },
    supplementing:{ sym: '✎', text: '补正中',   cls: 'warning' },
    in_review:    { sym: '◐', text: '审批中',   cls: 'warning' },
    approved:     { sym: '✓', text: '已批准',   cls: 'good' },
    concluded:    { sym: '◆', text: '已办结',   cls: 'good' },
    denied:       { sym: '✕', text: '不予通过', cls: 'critical' },
    not_accepted: { sym: '✕', text: '不予受理', cls: 'critical' }
  };
  function statusBadge(s) {
    var d = STATUS[s] || { sym: '·', text: s, cls: 'neutral' };
    return '<span class="badge ' + d.cls + '">' + d.sym + ' ' + esc(d.text) + '</span>';
  }
  function ymd(iso) { return iso ? esc(String(iso).slice(0, 10)) : '—'; }

  function renderItems(items) {
    document.getElementById('items-count').textContent = '（' + items.length + '）';
    var el = document.getElementById('items');
    if (!items.length) { el.innerHTML = '<div class="empty">暂无事项</div>'; return; }
    el.innerHTML = items.map(function (it) {
      var type = it.itemType ? '<span class="badge neutral">◆ ' + esc(it.itemType) + '</span>' : '';
      return '<div class="item">' +
        '<div class="name">' + esc(it.itemName) + ' ' + type + '</div>' +
        '<div class="code">' + esc(it.itemCode) + '</div>' +
        '<div class="info">实施机关：' + esc(it.implementOrg) + '</div>' +
        '<div class="days">' +
          '<span>承诺办结 <span class="n">' + esc(it.promiseDays) + '</span> 工作日</span>' +
          '<span>法定 <span class="n">' + esc(it.legalDays) + '</span> 工作日</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderApps(apps) {
    document.getElementById('apps-count').textContent = '（' + apps.length + '）';
    var el = document.getElementById('apps');
    if (!apps.length) { el.innerHTML = '<div class="empty">暂无申报单</div>'; return; }
    el.innerHTML = apps.map(function (a) {
      var overdue = (a.overdueDays != null && a.overdueDays > 0);
      var overdueBadge = overdue
        ? '<span class="badge critical">⚠ 超期 ' + esc(a.overdueDays) + ' 天</span>'
        : '';
      return '<div class="app' + (overdue ? ' overdue' : '') + '">' +
        statusBadge(a.status) +
        '<span class="no">' + esc(a.applyNo) + '</span>' +
        '<span class="item-name">' + esc(a.itemName) + '</span>' +
        '<span class="meta">申请人：' + esc(a.applicantName) + '</span>' +
        '<span class="meta">提交 ' + ymd(a.submittedAt) + '</span>' +
        '<span class="meta">受理 ' + ymd(a.acceptedAt) + '</span>' +
        overdueBadge +
      '</div>';
    }).join('');
  }

  async function refresh() {
    try {
      var results = await Promise.all([
        fetch('/api/items').then(function (r) { return r.json(); }),
        fetch('/api/applications').then(function (r) { return r.json(); })
      ]);
      renderItems(results[0]);
      renderApps(results[1]);
      document.getElementById('updated').textContent =
        '每 5 秒自动刷新 · 更新于 ' + new Date().toLocaleTimeString('zh-CN');
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
