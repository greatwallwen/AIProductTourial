import type { CSSProperties } from 'react';
import { Routes, Route, NavLink, useParams, Navigate } from 'react-router-dom';
import indexData from './data/index.json';
import themesData from './themes.json';

// 多套设计系统令牌（单一来源 design/themes.json）：按案例的 design 注入 CSS 变量，故各案例配色各异
const THEMES: Record<string, any> = {};
for (const th of (themesData as any).themes) THEMES[th.id] = th.t;
function themeVars(designId: string): CSSProperties {
  const t = THEMES[designId] || THEMES['graphite-hud'];
  const v: Record<string, string> = {
    '--bg': t.bg, '--bg2': t.bg2, '--panel': t.panel, '--panelSoft': t.panelSoft, '--border': t.border,
    '--grid': t.grid, '--ink': t.ink, '--ink2': t.ink2, '--muted': t.muted, '--accent': t.accent,
    '--accent2': t.accent2, '--ok': t.ok, '--warn': t.warn, '--bad': t.bad, '--glow': t.glow,
  };
  return v as CSSProperties;
}

// 载入 build_case_data 预计算的每案例视图模型（真实数据 → 离线确定）
const mods = import.meta.glob('./data/case_*.json', { eager: true }) as Record<string, { default: any }>;
const CASES: Record<string, any> = {};
for (const k in mods) { const m = mods[k].default; CASES[String(m.num).padStart(2, '0')] = m; }

const PHASES = ['角色转型', '用户洞察', '需求管理', '详细设计', '数据指标', 'AI协作', '质量验收', '综合闭环'];
const idx = indexData as any;
const pad = (n: number) => String(n).padStart(2, '0');

function Sidebar() {
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo">知</div>
        <div>
          <div className="sb-title">{idx.projectName}</div>
          <div className="sb-sub">{idx.cases.length} 个实操 · React 工作台</div>
        </div>
      </div>
      <NavLink to="/" end className={({ isActive }) => 'sb-item' + (isActive ? ' on' : '')}>总览</NavLink>
      {PHASES.map((ph) => {
        const list = idx.cases.filter((c: any) => c.phase === ph);
        if (!list.length) return null;
        return (
          <div key={ph} className="sb-group">
            <div className="sb-group-t">{ph}</div>
            {list.map((c: any) => (
              <NavLink key={c.num} to={`/case/${pad(c.num)}`} className={({ isActive }) => 'sb-item' + (isActive ? ' on' : '')}>
                <span className="sb-num">{pad(c.num)}</span>
                <span className="sb-name">{c.title.split('｜')[1]}</span>
                {c.highImpact && <span className="dot-hi" title="高影响行业·人工复核" />}
              </NavLink>
            ))}
          </div>
        );
      })}
    </aside>
  );
}

function Overview() {
  return (
    <div className="page">
      <div className="topbar"><h1>案例总览</h1><span className="muted">同一套 PM 工作流 · 19 个行业实操 · 真数据驱动</span></div>
      <div className="grid-cards">
        {idx.cases.map((c: any) => (
          <NavLink key={c.num} to={`/case/${pad(c.num)}`} className="ov-card">
            <div className="ov-top"><span className="chip">{pad(c.num)}</span><span className="chip ghost">{c.industry}</span>{c.highImpact && <span className="chip hi">人工复核</span>}</div>
            <div className="ov-title">{c.title.split('｜')[1]}</div>
            <div className="ov-meta">{c.title.split('｜')[0]} · {c.saasType}</div>
            <div className="ov-ph">{c.phase}{c.rp ? ` · ${c.rp}` : ''}</div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function Chart({ chart }: { chart: any }) {
  const W = 560, H = 210, P = 28;
  if (!chart || !chart.data?.length) return <div className="chart empty">无图表数据</div>;
  if (chart.type === 'bars') {
    const max = Math.max(...chart.data.map((d: any) => d.value)) || 1;
    const bw = (W - P * 2) / chart.data.length;
    return (
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {chart.data.map((d: any, i: number) => {
          const h = (d.value / max) * (H - P * 2);
          return (<g key={i}>
            <rect x={P + i * bw + 6} y={H - P - h} width={bw - 12} height={h} rx="4" className="bar" />
            <text x={P + i * bw + bw / 2} y={H - 8} className="axis">{d.label}</text>
            <text x={P + i * bw + bw / 2} y={H - P - h - 5} className="val">{d.value}</text>
          </g>);
        })}
      </svg>
    );
  }
  if (chart.type === 'funnel') {
    const max = chart.data[0].value || 1;
    const rh = (H - P * 2) / chart.data.length;
    return (
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {chart.data.map((d: any, i: number) => {
          const w = (d.value / max) * (W - P * 2);
          return (<g key={i}>
            <rect x={(W - w) / 2} y={P + i * rh + 3} width={w} height={rh - 6} rx="4" className="bar" />
            <text x={W / 2} y={P + i * rh + rh / 2 + 4} className="val ctr">{d.stage} · {d.value}</text>
          </g>);
        })}
      </svg>
    );
  }
  if (chart.type === 'pipeline') {
    const max = Math.max(...chart.data.map((d: any) => d.count)) || 1;
    const bw = (W - P * 2) / chart.data.length;
    return (
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {chart.data.map((d: any, i: number) => {
          const h = (d.count / max) * (H - P * 2);
          return (<g key={i}>
            <rect x={P + i * bw + 8} y={H - P - h} width={bw - 16} height={h} rx="4" className="bar alt" />
            <text x={P + i * bw + bw / 2} y={H - 8} className="axis">{d.stage}</text>
            <text x={P + i * bw + bw / 2} y={H - P - h - 5} className="val">{d.count}</text>
          </g>);
        })}
      </svg>
    );
  }
  // sparkline
  const ys = chart.data.map((d: any) => d.y); const max = Math.max(...ys), min = Math.min(...ys);
  const pts = chart.data.map((d: any, i: number) => {
    const x = P + (i / (chart.data.length - 1)) * (W - P * 2);
    const y = H - P - ((d.y - min) / (max - min || 1)) * (H - P * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} className="spark" fill="none" />
      {chart.data.map((d: any, i: number) => {
        const x = P + (i / (chart.data.length - 1)) * (W - P * 2);
        const y = H - P - ((d.y - min) / (max - min || 1)) * (H - P * 2);
        return <circle key={i} cx={x} cy={y} r="3" className="spark-dot" />;
      })}
    </svg>
  );
}

function stateClass(s: string) {
  if (/严重|高|越界|拒|失败|未闭环|未达成|超时|不足|待复核|越权/.test(s)) return 'bad';
  if (/预警|中|滞销|阻塞|待|下滑|异常/.test(s)) return 'warn';
  if (/GREEN|通过|正常|完成/.test(s)) return 'ok';
  return 'neutral';
}

function CaseScreen() {
  const { num } = useParams();
  const c = CASES[num || ''];
  if (!c) return <Navigate to="/" />;
  const [mod, scene] = c.title.split('｜');
  return (
    <div className="page" style={themeVars(c.design)}>
      <div className="topbar">
        <div>
          <div className="crumb">{c.phase} · 实操 {pad(c.num)} · {c.industry}</div>
          <h1>{scene}</h1>
          <div className="muted">{mod} · UI 原型 <code>{c.uiId}</code> · 数据 <code>{c.dataset}</code>（{c.rowCount} 行，异常 {c.exceptionCount}）</div>
          {c.demonstrates && <div className="demos">▹ 演示原理 {c.demonstrates.join(' · ')} · 设计 <code>{c.design}</code></div>}
        </div>
        <div className="skills">{c.skills.map((s: string) => <span key={s} className="chip ghost">{s}</span>)}</div>
      </div>

      {c.highImpact && <div className="banner hi">⚠ 高影响行业统一边界：保留人工复核，不得自动授信/处罚/诊断/拒绝交易。风险边界：{c.riskBoundary}</div>}

      <div className="kpis">
        {c.kpis.map((k: any, i: number) => (
          <div key={i} className="kpi">
            <div className="kpi-name">{k.name}</div>
            <div className="kpi-val">{typeof k.value === 'number' ? k.value.toLocaleString('zh-CN') : k.value}<span className="kpi-unit">{k.unit}</span></div>
            <div className={'kpi-trend ' + (String(k.trend).startsWith('+') ? 'up' : 'down')}>{k.trend}</div>
          </div>
        ))}
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-h"><h2>{c.saasType} · 趋势/结构</h2><span className="muted">{c.largeScreenRef}</span></div>
          <Chart chart={c.chart} />
          <div className="comp-row">{c.components.map((x: string) => <span key={x} className="chip soft">{x}</span>)}</div>
        </section>

        <section className="card">
          <div className="card-h"><h2>异常队列 · 责任对象</h2><span className="muted">{c.exceptionCount} 项 · 取前 {c.queue.length}</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>#</th><th>状态</th>{c.fields.slice(0, 4).map((f: string) => <th key={f}>{f}</th>)}<th>责任</th></tr></thead>
              <tbody>
                {c.queue.map((q: any) => (
                  <tr key={q.id}>
                    <td className="mono">{q.id}</td>
                    <td><span className={'badge ' + stateClass(q.state)}>{q.state}</span></td>
                    {c.fields.slice(0, 4).map((f: string) => <td key={f} className="cell">{String(q.fields[f] ?? '—')}</td>)}
                    <td><span className="chip owner">{q.owner || '—'}</span></td>
                  </tr>
                ))}
                {!c.queue.length && <tr><td colSpan={7} className="muted">该案例输入为结构化产物，见交付物与验收。</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="actions">
        <div className="act-l"><span className="act-t">行动入口</span>{c.actions.map((a: any, i: number) => (
          <button key={i} className="act-btn">{a.label}<span className="act-owner">{a.owner} · {a.due}</span></button>
        ))}</div>
        <div className="act-r"><span className="act-t">决策动作</span><span className="muted">{c.decisionAction}</span></div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/case/:num" element={<CaseScreen />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
