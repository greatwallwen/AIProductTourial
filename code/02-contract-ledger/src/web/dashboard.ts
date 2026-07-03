/**
 * 内嵌 HTML 看板：单路由返回、零外部资源、原生 JS 轮询两个只读接口
 * （合同台账 /api/contracts 与 到期提醒 /api/contracts/reminders?days=30）。
 * 注意：内部 JS 一律用字符串拼接而非模板字符串，避免与本 TS 模板字符串的 ${} 冲突。
 * 无障碍：状态永远「符号 + 文字」成对出现，颜色只作辅助，不单独表意。
 */
export const dashboardHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>企业合同管理台账</title>
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
  .list { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;
         background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
  .row.expired { border-color: var(--critical); }
  .row .no { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .row .title { color: var(--ink-2); font-weight: 600; }
  .row .amount { color: var(--ink); font-weight: 650; font-variant-numeric: tabular-nums; }
  .row .meta { font-size: 12px; color: var(--muted); }
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
  <h1>企业合同管理台账</h1>
  <span class="sub" id="updated">加载中…</span>
</header>
<main>
  <h2>到期提醒 · 30 天内 <span class="count" id="rem-count"></span></h2>
  <div class="list" id="reminders"></div>
  <h2>合同台账 <span class="count" id="con-count"></span></h2>
  <div class="list" id="contracts"></div>
</main>
<script>
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }

  // 派生状态永远「符号 + 文字」成对出现，颜色只作辅助
  var STATUS = {
    draft:      { sym: '○', text: '起草',   cls: 'neutral' },
    approving:  { sym: '◐', text: '审批中', cls: 'warning' },
    rejected:   { sym: '✕', text: '已驳回', cls: 'critical' },
    active:     { sym: '✓', text: '生效中', cls: 'good' },
    terminated: { sym: '■', text: '已终止', cls: 'neutral' },
    expired:    { sym: '⚠', text: '已过期', cls: 'critical' }
  };
  function statusBadge(s) {
    var d = STATUS[s] || { sym: '·', text: s, cls: 'neutral' };
    return '<span class="badge ' + d.cls + '">' + d.sym + ' ' + esc(d.text) + '</span>';
  }
  // 金额千分位（amount 为元字符串，如 "1280000.00"）
  function money(a) {
    var s = String(a == null ? '0' : a);
    var parts = s.split('.');
    var intp = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
    return '¥' + intp + (parts[1] != null ? '.' + parts[1] : '');
  }

  function renderReminders(items) {
    document.getElementById('rem-count').textContent = '（' + items.length + '）';
    var el = document.getElementById('reminders');
    if (!items.length) {
      el.innerHTML = '<div class="empty"><span class="badge good">✓ 无</span> 30 天内暂无到期合同</div>';
      return;
    }
    el.innerHTML = items.map(function (r) {
      var soon = r.daysLeft <= 7;
      return '<div class="row' + (soon ? ' expired' : '') + '">' +
        '<span class="badge ' + (soon ? 'critical' : 'warning') + '">⚠ 剩 ' + esc(r.daysLeft) + ' 天</span>' +
        '<span class="no">' + esc(r.contractNo) + '</span>' +
        '<span class="title">' + esc(r.title) + '</span>' +
        '<span class="meta">对方：' + esc(r.counterparty) + '</span>' +
        '<span class="amount">' + money(r.amount) + '</span>' +
        '<span class="meta">到期 ' + esc(r.expireDate) + '</span>' +
        '<span class="meta">负责人：' + esc(r.owner) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderContracts(items) {
    document.getElementById('con-count').textContent = '（' + items.length + '）';
    var el = document.getElementById('contracts');
    if (!items.length) { el.innerHTML = '<div class="empty">暂无合同</div>'; return; }
    el.innerHTML = items.map(function (c) {
      var d = c.derivedStatus || c.status;
      return '<div class="row' + (d === 'expired' ? ' expired' : '') + '">' +
        statusBadge(d) +
        '<span class="no">' + esc(c.contractNo) + '</span>' +
        '<span class="title">' + esc(c.title) + '</span>' +
        '<span class="meta">对方：' + esc(c.counterparty) + '</span>' +
        '<span class="amount">' + money(c.amount) + '</span>' +
        '<span class="meta">生效 ' + esc(c.effectiveDate) + ' ~ ' + esc(c.expireDate) + '</span>' +
        '<span class="meta">负责人：' + esc(c.owner) + '</span>' +
      '</div>';
    }).join('');
  }

  async function refresh() {
    try {
      var results = await Promise.all([
        fetch('/api/contracts/reminders?days=30').then(function (r) { return r.json(); }),
        fetch('/api/contracts').then(function (r) { return r.json(); })
      ]);
      renderReminders(results[0]);
      renderContracts(results[1]);
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
