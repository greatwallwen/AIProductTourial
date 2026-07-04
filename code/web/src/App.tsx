import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useParams, Navigate } from 'react-router-dom';
import themesData from './themes.json';
import { fetchIndex, fetchCaseData, type IndexData } from './lib/api';
import { SpecialScreen } from './screens';
import { LabPage } from './lab';
import { Home, Search, PrincipleIndex, ApiDocs } from './pages';
import { GamePage } from './game';
import { Challenge } from './challenge';
import { markViewed } from './progress';

// 亮/暗主题：切换 <html data-theme> 并持久化
function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('pmkb-theme') || 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('pmkb-theme', theme); }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function TopNav() {
  const [theme, toggle] = useTheme();
  const link = ({ isActive }: { isActive: boolean }) => 'topnav-link' + (isActive ? ' on' : '');
  return (
    <header className="topnav">
      <nav aria-label="主导航" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <NavLink to="/" end className={link}>首页</NavLink>
        <NavLink to="/cases" className={link}>案例</NavLink>
        <NavLink to="/lab/tokenizer" className={link}>概念实验室</NavLink>
        <NavLink to="/game" className={link}>小游戏</NavLink>
        <NavLink to="/principles" className={link}>原理索引</NavLink>
        <NavLink to="/api-docs" className={link}>API 文档</NavLink>
      </nav>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <NavLink to="/search" className="topnav-link" aria-label="搜索">🔍 搜索</NavLink>
        <button className="topnav-link" onClick={toggle} aria-label="切换亮暗主题">{theme === 'dark' ? '☀ 亮色' : '☾ 暗色'}</button>
      </div>
    </header>
  );
}

// 多套设计系统令牌（单一来源 design/themes.json）：按案例 design 注入 CSS 变量，故各案例配色各异
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

const PHASES = ['角色转型', '用户洞察', '需求管理', '详细设计', '系统架构', '数据指标', 'AI协作', '质量验收', '综合闭环'];
const pad = (n: number) => String(n).padStart(2, '0');

function Sidebar({ idx }: { idx: IndexData }) {
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo">知</div>
        <div>
          <div className="sb-title">{idx.projectName}</div>
          <div className="sb-sub">{idx.cases.length} 个实操 · 全栈服务</div>
        </div>
      </div>
      <NavLink to="/" end className={({ isActive }) => 'sb-item' + (isActive ? ' on' : '')}>总览</NavLink>
      {PHASES.map((ph) => {
        const list = idx.cases.filter((c) => c.phase === ph);
        if (!list.length) return null;
        return (
          <div key={ph} className="sb-group">
            <div className="sb-group-t">{ph}</div>
            {list.map((c) => (
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

function Overview({ idx }: { idx: IndexData }) {
  return (
    <div className="page">
      <div className="topbar"><h1>案例总览</h1><span className="muted">同一套 PM 工作流 · {idx.cases.length} 个行业实操 · 后端实时数据</span></div>
      <div className="grid-cards">
        {idx.cases.map((c) => (
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
  const line = chart.data.map((d: any, i: number) => {
    const x = P + (i / (chart.data.length - 1)) * (W - P * 2);
    const y = H - P - ((d.y - min) / (max - min || 1)) * (H - P * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      <polyline points={line} className="spark" fill="none" />
      {chart.data.map((d: any, i: number) => {
        const x = P + (i / (chart.data.length - 1)) * (W - P * 2);
        const y = H - P - ((d.y - min) / (max - min || 1)) * (H - P * 2);
        return <circle key={i} cx={x} cy={y} r="3" className="spark-dot" />;
      })}
    </svg>
  );
}

// 二维矩阵/散点纯图形（案例02：业务价值 × 研发工期，气泡=需求项，色=风险）——只出图形不出字段
function MatrixChart({ points }: { points: Array<{ x: number; y: number; r: number; risk: number; label: string }> }) {
  const W = 720, H = 380, P = 46;
  const mx = Math.max(...points.map((p) => p.x), 1), my = Math.max(...points.map((p) => p.y), 1);
  const col = ['var(--ok)', 'var(--warn)', 'var(--bad)'];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 460 }}>
      <line x1={P} y1={H - P} x2={W - 10} y2={H - P} stroke="var(--border)" />
      <line x1={P} y1={20} x2={P} y2={H - P} stroke="var(--border)" />
      <text x={W / 2} y={H - 10} className="axis">业务价值 →</text>
      <text x={16} y={H / 2} className="axis" transform={`rotate(-90 16 ${H / 2})`}>研发工期 →</text>
      {points.map((p, i) => {
        const cx = P + (p.x / mx) * (W - P - 20);
        const cy = H - P - (p.y / my) * (H - P - 20);
        return (<g key={i}>
          <circle cx={cx} cy={cy} r={6 + p.r * 10} fill={col[p.risk] || col[0]} opacity="0.75" />
          <text x={cx} y={cy - 8 - p.r * 10} className="val">{p.label}</text>
        </g>);
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
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { setC(null); setErr(false); fetchCaseData(num || '').then((d) => { setC(d); markViewed(d.num); }).catch(() => setErr(true)); }, [num]);
  if (err) return <Navigate to="/" />;
  if (!c) return <div className="page"><div className="muted">加载中…</div></div>;
  const [mod, scene] = c.title.split('｜');
  // 案例02 派生矩阵点（业务价值×研发工期），只出图形
  const matrixPoints = (c.queue || []).slice(0, 12).map((q: any, i: number) => ({
    x: 20 + ((i * 37) % 80), y: 15 + ((i * 53) % 70), r: (i % 3) / 3, risk: i % 3, label: String(Object.values(q.fields || {})[0] ?? i + 1).slice(0, 6),
  }));
  return (
    <div className="page" style={themeVars(c.design)}>
      <div className="topbar">
        <div>
          <div className="crumb">{c.phase} · 实操 {pad(c.num)} · {c.industry}</div>
          <h1>{scene}</h1>
          <div className="muted">{mod} · UI 原型 <code>{c.uiId}</code> · 数据 <code>{c.dataset}</code>（{c.rowCount} 行，异常 {c.exceptionCount}）{c.liveComputed && <span className="chip soft" style={{ marginLeft: 8 }}>后端实时</span>}</div>
          {c.demonstrates && <div className="demos">▹ 演示原理 {c.demonstrates.join(' · ')} · 设计 <code>{c.design}</code></div>}
          {c.difficulty && <div className="demos" style={{ color: 'var(--ink2)' }}><span className="badge neutral" style={{ marginRight: 6 }}>难度 {c.difficulty}</span>🎯 {c.tldr}</div>}
        </div>
        <div className="skills">{(c.skills || []).map((s: string) => <span key={s} className="chip ghost">{s}</span>)}</div>
      </div>

      {c.highImpact && <div className="banner hi">⚠ 高影响行业统一边界：保留人工复核，不得自动授信/处罚/诊断/拒绝交易。风险边界：{c.riskBoundary}</div>}

      {c.graphicOnly ? (
        <section className="card">
          <div className="card-h"><h2>{c.saasType} · 价值×工期矩阵</h2><span className="muted">气泡=需求项 · 色=风险等级</span></div>
          <MatrixChart points={matrixPoints} />
          <div className="comp-row">{(c.components || []).map((x: string) => <span key={x} className="chip soft">{x}</span>)}</div>
        </section>
      ) : c.screen ? (
        <SpecialScreen screen={c.screen} />
      ) : (
        <>
          <div className="kpis">
            {(c.kpis || []).map((k: any, i: number) => (
              <div key={i} className="kpi">
                <div className="kpi-name">{k.name}</div>
                <div className="kpi-val">{typeof k.value === 'number' ? k.value.toLocaleString('zh-CN') : k.value}<span className="kpi-unit">{k.unit}</span></div>
                {k.trend && <div className={'kpi-trend ' + (String(k.trend).startsWith('+') ? 'up' : 'down')}>{k.trend}</div>}
              </div>
            ))}
          </div>

          <div className="cols">
            <section className="card">
              <div className="card-h"><h2>{c.saasType} · 趋势/结构</h2><span className="muted">{c.largeScreenRef}</span></div>
              <Chart chart={c.chart} />
              <div className="comp-row">{(c.components || []).map((x: string) => <span key={x} className="chip soft">{x}</span>)}</div>
            </section>

            <section className="card">
              <div className="card-h"><h2>异常队列 · 责任对象</h2><span className="muted">{c.exceptionCount} 项 · 取前 {(c.queue || []).length}</span></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>#</th><th>状态</th>{(c.fields || []).slice(0, 4).map((f: string) => <th key={f}>{f}</th>)}<th>责任</th></tr></thead>
                  <tbody>
                    {(c.queue || []).map((q: any) => (
                      <tr key={q.id}>
                        <td className="mono">{q.id}</td>
                        <td><span className={'badge ' + stateClass(q.state)}>{q.state}</span></td>
                        {(c.fields || []).slice(0, 4).map((f: string) => <td key={f} className="cell">{String(q.fields?.[f] ?? '—')}</td>)}
                        <td><span className="chip owner">{q.owner || '—'}</span></td>
                      </tr>
                    ))}
                    {!(c.queue || []).length && <tr><td colSpan={7} className="muted">该案例输入为结构化产物，见交付物与验收。</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="actions">
            <div className="act-l"><span className="act-t">行动入口</span>{(c.actions || []).map((a: any, i: number) => (
              <button key={i} className="act-btn">{a.label}<span className="act-owner">{a.owner} · {a.due}</span></button>
            ))}</div>
            <div className="act-r"><span className="act-t">决策动作</span><span className="muted">{c.decisionAction}</span></div>
          </div>
        </>
      )}
      <Challenge data={c} />
    </div>
  );
}

export default function App() {
  const [idx, setIdx] = useState<IndexData | null>(null);
  useEffect(() => { fetchIndex().then(setIdx).catch(() => setIdx({ projectName: '加载失败', cases: [] })); }, []);
  if (!idx) return <div className="shell"><main className="main"><div className="page"><div className="muted">加载中…</div></div></main></div>;
  return (
    <div className="shell">
      <Sidebar idx={idx} />
      <main className="main">
        <TopNav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cases" element={<Overview idx={idx} />} />
          <Route path="/case/:num" element={<CaseScreen />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/lab/:demo" element={<LabPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/search" element={<Search />} />
          <Route path="/principles" element={<PrincipleIndex />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
