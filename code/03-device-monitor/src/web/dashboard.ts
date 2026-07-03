/**
 * 内嵌 HTML 看板：单路由返回、零外部资源、原生 JS 轮询三个只读接口
 * （设备列表 / firing 告警 / 单设备近 1 小时聚合）。
 * 注意：内部 JS 一律用字符串拼接而非模板字符串，避免与本 TS 模板字符串的 ${} 冲突。
 */
export const dashboardHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>液压系统状态监测看板</title>
<style>
  :root {
    --page: #0d0d0d; --card: #1a1a19; --line: #2c2c2a;
    --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --good: #0ca30c; --warning: #fab219; --critical: #d03b3b;
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
  .alert-list { display: flex; flex-direction: column; gap: 8px; }
  .alert { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;
           background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
  .alert .meta { font-size: 12px; color: var(--muted); }
  .alert .title { color: var(--ink); font-weight: 600; }
  .badge { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
  .badge.critical { color: var(--critical); border: 1px solid var(--critical); }
  .badge.warning  { color: var(--warning);  border: 1px solid var(--warning); }
  .badge.good     { color: var(--good);     border: 1px solid var(--good); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
  .device { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .device.alert-critical { border-color: var(--critical); }
  .device.alert-warning { border-color: var(--warning); }
  .device .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .device .name { color: var(--ink); font-size: 15px; font-weight: 600; }
  .device .info { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
  .tile { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
  .tile .label { font-size: 11px; color: var(--muted); }
  .tile .value { font-size: 22px; font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; }
  .tile .range { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .empty { color: var(--muted); font-size: 13px; padding: 8px 2px; }
</style>
</head>
<body>
<header>
  <h1>液压系统状态监测看板</h1>
  <span class="sub" id="updated">加载中…</span>
</header>
<main>
  <h2>未恢复告警</h2>
  <div class="alert-list" id="alerts"></div>
  <h2>设备（近 1 小时）</h2>
  <div class="grid" id="devices"></div>
</main>
<script>
  var METRIC_LABELS = {
    system_pressure: '系统压力 (bar)',
    pump_vibration: '泵振动速度 (mm/s)',
    oil_temperature: '液压油温度 (°C)',
    cooler_outlet_temp: '冷却器出口温度 (°C)',
    cooling_efficiency: '冷却效率 (%)',
    cooling_power: '冷却功率 (kW)',
    volume_flow: '主回路流量 (l/min)'
  };
  function label(metric) { return METRIC_LABELS[metric] || metric; }
  function fmt(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }
  function hhmm(iso) { return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); }

  // 状态永远「符号 + 文字」成对出现，不用颜色单独表意
  function badge(level) {
    if (level === 'critical') return '<span class="badge critical">▲ 严重</span>';
    if (level === 'warning') return '<span class="badge warning">● 预警</span>';
    return '<span class="badge good">✓ 正常</span>';
  }

  function renderAlerts(alerts) {
    var el = document.getElementById('alerts');
    if (alerts.length === 0) {
      el.innerHTML = '<div class="empty">' + badge('good') + ' 当前无 firing 告警</div>';
      return;
    }
    el.innerHTML = alerts.map(function (a) {
      return '<div class="alert">' + badge(a.level) +
        '<span class="title">' + esc(a.title) + '</span>' +
        '<span class="meta">' + esc(a.deviceName) + '（' + esc(a.deviceCode) + '）· ' + esc(label(a.metric)) + '</span>' +
        '<span class="meta">峰值 ' + fmt(a.peakValue) + '（阈值 ' + esc(a.op) + ' ' + a.threshold + '）</span>' +
        '<span class="meta">' + hhmm(a.firstTs) + ' 起，最近 ' + hhmm(a.lastTs) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderDevices(devices, summaries, alerts) {
    // 设备卡片状态取该设备 firing 告警的最高级别（critical 优先于 warning）
    var alerting = {};
    alerts.forEach(function (a) {
      if (alerting[a.deviceCode] !== 'critical') alerting[a.deviceCode] = a.level;
    });
    document.getElementById('devices').innerHTML = devices.map(function (d, i) {
      var tiles = summaries[i].metrics.map(function (m) {
        return '<div class="tile">' +
          '<div class="label">' + esc(label(m.metric)) + '</div>' +
          '<div class="value">' + fmt(m.last) + '</div>' +
          '<div class="range">均 ' + fmt(m.avg) + ' · 低 ' + fmt(m.min) + ' · 高 ' + fmt(m.max) + '</div>' +
          '</div>';
      }).join('');
      var level = alerting[d.deviceCode];
      return '<div class="device' + (level ? ' alert-' + level : '') + '">' +
        '<div class="head"><span class="name">' + esc(d.name) + '</span>' +
        (level ? badge(level).replace(level === 'critical' ? '严重' : '预警', '告警中') : badge('good')) + '</div>' +
        '<div class="info">' + esc(d.deviceCode) + ' · ' + esc(d.vendor) + ' ' + esc(d.model) + ' · ' + esc(d.location) + '</div>' +
        '<div class="info">网关：' + esc(d.gateway) + '</div>' +
        '<div class="tiles">' + (tiles || '<div class="empty">近 1 小时无遥测</div>') + '</div>' +
        '</div>';
    }).join('');
  }

  async function refresh() {
    try {
      var results = await Promise.all([
        fetch('/api/devices').then(function (r) { return r.json(); }),
        fetch('/api/alerts?status=firing').then(function (r) { return r.json(); })
      ]);
      var devices = results[0], alerts = results[1];
      var summaries = await Promise.all(devices.map(function (d) {
        return fetch('/api/devices/' + encodeURIComponent(d.deviceCode) + '/summary')
          .then(function (r) { return r.json(); });
      }));
      renderAlerts(alerts);
      renderDevices(devices, summaries, alerts);
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
