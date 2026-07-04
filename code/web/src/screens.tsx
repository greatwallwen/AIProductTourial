import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { fetchSearch, fetchDbQuery, fetchPoints3d, fetchHealth, fetchRfm, fetchHospital, fetchAdFunnel, fetchRiskReview } from './lib/api';
// three.js 独立 chunk，仅在渲染 3D 案例时动态加载（首屏不含 three）
const Chart3D = lazy(() => import('./chart3d'));

// 架构/向量库/PG/3D 案例的「真实后端」案例屏：全部 live 调后端接口。

// —— 向量库检索(RAG)：调 /api/search 展示命中片段与相似度 ——
function RagScreen() {
  const [q, setQ] = useState('product roadmap prioritization');
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const run = (query: string) => { setLoading(true); fetchSearch(query).then(setRes).finally(() => setLoading(false)); };
  useEffect(() => { run(q); }, []);
  return (
    <section className="card">
      <div className="card-h"><h2>语义检索 · RAG</h2><span className="muted">语料 {res?.corpus ?? '…'} 篇 · 纯 JS 向量库(TF-IDF+余弦) · /api/search</span></div>
      <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(q)}
          style={{ flex: 1, background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', padding: '8px 12px', fontSize: 13 }} />
        <button className="act-btn" onClick={() => run(q)}>{loading ? '检索中…' : '检索'}</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>#</th><th>命中文档</th><th>相似度</th><th>片段</th></tr></thead>
          <tbody>
            {(res?.hits || []).map((h: any, i: number) => (
              <tr key={i}><td className="mono">{i + 1}</td><td className="cell">{h.id}</td>
                <td><span className="badge ok">{h.score}</span></td><td className="cell" style={{ maxWidth: 360 }}>{h.snippet}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// —— 关系库查询(PostgreSQL 架构)：调 /api/db/query 展示真实 SQL 结果 ——
function DbScreen() {
  const [res, setRes] = useState<any>(null);
  useEffect(() => { fetchDbQuery().then(setRes); }, []);
  return (
    <section className="card">
      <div className="card-h"><h2>关系库查询 · SQL</h2><span className="muted">{res?.engine ?? '…'} · /api/db/query</span></div>
      <pre className="mono" style={{ background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 11.5, color: 'var(--accent)', overflowX: 'auto' }}>
{`SELECT region, COUNT(*) n, ROUND(SUM(amount)) amt
FROM orders GROUP BY region ORDER BY amt DESC;   -- 真 node:sqlite，建表+索引+参数化`}
      </pre>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>区域 region</th><th>订单数 n</th><th>销售额 amt</th></tr></thead>
          <tbody>
            {(res?.rows || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.region}</td><td className="mono">{r.n}</td><td className="mono">{Number(r.amt).toLocaleString('zh-CN')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// —— 系统架构：子系统分解 + 真实健康检查(接口契约) ——
function ArchScreen() {
  const [h, setH] = useState<any>(null);
  useEffect(() => { fetchHealth().then(setH); }, []);
  const layers = [
    ['routes', 'HTTP 层：只做输入输出，不写业务'],
    ['services', '业务层：实时读 CSV 计算，不碰 HTTP'],
    ['data', '数据装载：CSV 解析'],
    ['db', 'node:sqlite 真关系库（PG 架构）'],
    ['vector', '纯 JS 真实向量库（RAG）'],
    ['tests', 'node:test = Loop 的 checker'],
  ];
  return (
    <section className="card">
      <div className="card-h"><h2>子系统分解 · 接口契约</h2><span className="muted">本教程后端自身 · dogfood · /api/health</span></div>
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {layers.map(([k, v]) => (
          <div key={k} className="kpi"><div className="kpi-name mono" style={{ color: 'var(--accent)' }}>code/server/{k}</div><div style={{ fontSize: 12, marginTop: 4 }}>{v}</div></div>
        ))}
      </div>
      <div className="banner" style={{ marginTop: 14, color: 'var(--ok)', borderColor: 'var(--ok)' }}>
        接口契约健康检查（真实调用）：{h ? `${JSON.stringify(h)} — 200 OK` : '…'}
      </div>
    </section>
  );
}

// —— three.js 3D 散点：真三维在独立 chunk（chart3d.tsx，懒加载）；无 WebGL 退化为等距投影伪 3D ——
// 无 WebGL（如无头环境）时退化为等距投影伪 3D 散点（同一份真实数据点）
function PseudoScatter({ points }: { points: Array<{ x: number; y: number; z: number; c: number }> }) {
  const W = 760, H = 420, cx = W / 2, cy = H / 2 + 60;
  const nrm = (v: number, a: number[]) => { const mn = Math.min(...a), mx = Math.max(...a); return (v - mn) / ((mx - mn) || 1); };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), zs = points.map((p) => p.z);
  const col = ['var(--ok)', 'var(--warn)', 'var(--accent2)', '#a855f7', 'var(--bad)'];
  const proj = points.map((p) => {
    const x = (nrm(p.x, xs) - 0.5) * 2, y = (nrm(p.y, ys) - 0.5) * 2, z = (nrm(p.z, zs) - 0.5) * 2;
    return { sx: cx + (x - z) * 150, sy: cy - y * 150 + (x + z) * 55, c: p.c };
  });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 440 }}>
      <line x1={cx} y1={cy} x2={cx + 170} y2={cy + 62} stroke="var(--border)" />
      <line x1={cx} y1={cy} x2={cx - 170} y2={cy + 62} stroke="var(--border)" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 170} stroke="var(--border)" />
      {proj.map((p, i) => <circle key={i} cx={p.sx} cy={p.sy} r="4.5" fill={col[p.c % col.length]} opacity="0.8" />)}
      <text x={cx + 120} y={cy + 66} className="axis">单价</text><text x={cx - 130} y={cy + 66} className="axis">金额</text><text x={cx + 6} y={cy - 160} className="axis">数量</text>
    </svg>
  );
}
function ThreeScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchPoints3d().then(setD); }, []);
  // WebGL 探测：可用则 R3F 真三维，否则等距投影伪 3D（无头环境稳定出图）
  const hasWebGL = useMemo(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch { return false; } }, []);
  return (
    <section className="card">
      <div className="card-h"><h2>三维经营散点 · three.js</h2><span className="muted">{d?.count ?? '…'} 点 · 单价×数量×金额，色=品类 · /api/points3d{!hasWebGL && ' · 等距投影(无 WebGL)'}</span></div>
      <div style={{ height: 440, borderRadius: 10, overflow: 'hidden', background: 'var(--bg2)' }}>
        {d && hasWebGL && <Suspense fallback={<div className="muted" style={{ padding: 20 }}>加载 three.js…</div>}><Chart3D points={d.points} /></Suspense>}
        {d && !hasWebGL && <PseudoScatter points={d.points} />}
      </div>
    </section>
  );
}

// —— 航空会员 RFM 专属 demo（案例30）：真实分层 + 高价值流失预警 + R×F 散点 ——
const SEG_COLORS: Record<string, string> = { '重要价值': 'var(--ok)', '高价值流失': 'var(--bad)', '重要保持': 'var(--accent)', '重要发展': 'var(--accent2)', '一般维持': 'var(--muted)', '流失预警': 'var(--warn)' };
function RfmScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchRfm().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载 RFM…</div></section>;
  const maxSpend = Math.max(...d.segments.map((s: any) => s.avgSpend));
  const maxR = Math.max(...d.scatter.map((p: any) => p.x), 1), maxF = Math.max(...d.scatter.map((p: any) => p.y), 1);
  return (
    <>
      <div className="banner" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>⚠ 高价值流失预警：<b>{d.churnRisk}</b> 名会员（{d.churnRate}%）年消费居前列却已久未乘机（R 偏大）——过去高价值、正在流失，最该优先干预。</div>
      <div className="cols">
        <section className="card">
          <div className="card-h"><h2>RFM 会员分层 · {d.total} 人</h2><span className="muted">按 R/F/M 真算 · 条长=均消费</span></div>
          {d.segments.map((s: any) => (
            <div key={s.name} style={{ margin: '9px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--ink)' }}><span style={{ color: SEG_COLORS[s.name] }}>●</span> {s.name}</span><span className="mono" style={{ color: 'var(--ink2)' }}>{s.count} 人 · 均消费 {s.avgSpend.toLocaleString('zh-CN')}</span></div>
              <div style={{ height: 8, background: 'var(--panelSoft)', borderRadius: 4, marginTop: 3 }}><div style={{ width: `${(s.avgSpend / maxSpend) * 100}%`, height: '100%', background: SEG_COLORS[s.name] || 'var(--accent)', borderRadius: 4 }} /></div>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-h"><h2>R × F 散点（色=分层）</h2><span className="muted">右下=久未乘机+低频 → 流失区</span></div>
          <svg className="chart" viewBox="0 0 560 300">
            <line x1="42" y1="268" x2="552" y2="268" stroke="var(--border)" /><line x1="42" y1="18" x2="42" y2="268" stroke="var(--border)" />
            <text x="300" y="290" className="axis">最近乘机天数 R →（越大越久未飞）</text><text x="16" y="150" className="axis" transform="rotate(-90 16 150)">年飞行次数 F →</text>
            {d.scatter.map((p: any, i: number) => <circle key={i} cx={42 + (p.x / maxR) * 508} cy={268 - (p.y / maxF) * 246} r="3.2" fill={SEG_COLORS[p.seg] || 'var(--muted)'} opacity="0.72" />)}
          </svg>
          <div className="ov-top" style={{ marginTop: 8 }}>{Object.entries(SEG_COLORS).map(([n, c]) => <span key={n} className="chip" style={{ borderColor: c }}><span style={{ color: c }}>●</span> {n}</span>)}</div>
        </section>
      </div>
    </>
  );
}

// —— 医院容量调度专属 demo（案例16）：按科室号源利用率/爽约率/均等待 + 时段分布 ——
function HospitalScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchHospital().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载科室容量…</div></section>;
  const maxWait = Math.max(...d.depts.map((x: any) => x.avgWait), 1);
  const maxSlot = Math.max(...d.slots.map((x: any) => x.count), 1);
  const wc = (r: number) => r >= 14 ? 'var(--bad)' : r >= 10 ? 'var(--warn)' : 'var(--ok)';
  return (
    <>
      <div className="banner" style={{ color: 'var(--warn)', borderColor: 'var(--warn)' }}>平均爽约率 <b>{d.avgNoshow}%</b>（{d.total} 就诊）——爽约高的科室号源被浪费、等待长的科室患者体验差，容量调度要按科室差异分别施策，不能一刀切。</div>
      <div className="cols">
        <section className="card">
          <div className="card-h"><h2>科室容量（按均等待排序）</h2><span className="muted">条长=均等待 · 色=爽约风险</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>科室</th><th>就诊数</th><th>均等待(分)</th><th>号源利用率</th><th>爽约率</th></tr></thead>
              <tbody>
                {d.depts.map((x: any) => (
                  <tr key={x.name}>
                    <td style={{ color: 'var(--ink)' }}>{x.name}</td><td className="mono">{x.count}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: `${(x.avgWait / maxWait) * 70}px`, height: 8, background: 'var(--accent)', borderRadius: 4 }} /><span className="mono">{x.avgWait}</span></div></td>
                    <td className="mono">{x.utilRate}%</td>
                    <td><span className="badge" style={{ background: 'color-mix(in srgb,' + wc(x.noshowRate) + ' 20%,transparent)', color: wc(x.noshowRate) }}>{x.noshowRate}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h2>预约时段分布</h2><span className="muted">识别高峰时段做分时放号</span></div>
          <svg className="chart" viewBox="0 0 480 240">
            <line x1="40" y1="210" x2="470" y2="210" stroke="var(--border)" />
            {d.slots.map((s: any, i: number) => { const bw = 420 / d.slots.length, h = (s.count / maxSlot) * 170; return (<g key={i}><rect x={44 + i * bw} y={210 - h} width={bw - 14} height={h} rx="4" fill="var(--accent2)" /><text x={44 + i * bw + (bw - 14) / 2} y={226} className="axis">{s.name}</text><text x={44 + i * bw + (bw - 14) / 2} y={210 - h - 4} className="val">{s.count}</text></g>); })}
          </svg>
        </section>
      </div>
    </>
  );
}

// —— 广告投放漏斗专属 demo（案例31）：按渠道 CTR/CVR/CPA 对比 + 漏斗断点，把预算从量大挪到效率高 ——
function AdFunnelScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchAdFunnel().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载投放漏斗…</div></section>;
  const maxCvr = Math.max(...d.channels.map((x: any) => x.cvr), 1);
  return (
    <>
      <div className="banner" style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }}>复盘结论：<b>{d.best}</b> 转化效率最高（优质渠道，该加预算）；<b>{d.worst}</b> 点击不低但转化垫底（落地页/人群问题，该查断点）。别只看曝光/点击，按 CVR/CPA 重分配预算。</div>
      <section className="card">
        <div className="card-h"><h2>渠道漏斗对比（按 CVR 排序）</h2><span className="muted">曝光→点击→转化 · CTR/CVR/CPA 真算</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>渠道</th><th>曝光</th><th>点击</th><th>转化</th><th>CTR</th><th>CVR（条）</th><th>CPA</th></tr></thead>
            <tbody>
              {d.channels.map((x: any) => {
                const tag = x.name === d.best ? 'ok' : x.name === d.worst ? 'bad' : 'neutral';
                return (
                  <tr key={x.name}>
                    <td style={{ color: 'var(--ink)' }}>{x.name}{x.name === d.best ? ' ✦' : x.name === d.worst ? ' ⚠' : ''}</td>
                    <td className="mono">{x.imp.toLocaleString('zh-CN')}</td><td className="mono">{x.clk.toLocaleString('zh-CN')}</td><td className="mono">{x.cvt}</td>
                    <td className="mono">{x.ctr}%</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: `${(x.cvr / maxCvr) * 90}px`, height: 8, background: `var(--${tag === 'neutral' ? 'accent' : tag})`, borderRadius: 4 }} /><span className="mono">{x.cvr}%</span></div></td>
                    <td><span className={'badge ' + tag}>{x.cpa}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// —— 金融风控复核专属 demo（案例28，高影响）：风险分布 + 高优先复核队列（高风险×大金额），保留人工复核 ——
function RiskScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchRiskReview().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载风控队列…</div></section>;
  const lc: Record<string, string> = { '高': 'var(--bad)', '中': 'var(--warn)', '低': 'var(--ok)' };
  return (
    <>
      <div className="banner" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>{d.total} 笔交易 · 高风险 <b>{d.highRate}%</b> · 待复核 {d.reviewRate}%。人工复核有限，按「风险等级 × 金额」优先——高影响行业：<b>保留人工复核，模型不得自动拒付</b>。</div>
      <div className="cols">
        <section className="card">
          <div className="card-h"><h2>风险等级分布</h2><span className="muted">笔数 · 均金额</span></div>
          {d.levels.map((x: any) => (
            <div key={x.name} style={{ margin: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: lc[x.name] || 'var(--ink)' }}>● {x.name}风险</span><span className="mono">{x.count} 笔 · 均 {x.avgAmt.toLocaleString('zh-CN')}</span></div>
              <div style={{ height: 8, background: 'var(--panelSoft)', borderRadius: 4, marginTop: 3 }}><div style={{ width: `${(x.count / d.total) * 100}%`, height: '100%', background: lc[x.name] || 'var(--accent)', borderRadius: 4 }} /></div>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-h"><h2>高优先复核队列</h2><span className="muted">高风险 × 大金额 Top8</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>交易号</th><th>金额</th><th>渠道</th><th>风险信号</th><th>命中规则</th></tr></thead>
              <tbody>
                {d.priority.map((p: any, i: number) => (
                  <tr key={i}><td className="mono cell">{p.txn}</td><td className="mono">{p.amt.toLocaleString('zh-CN')}</td><td>{p.ch}</td><td><span className="badge bad">{p.sig}</span></td><td className="mono">{p.rules}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export function SpecialScreen({ screen }: { screen: string }) {
  if (screen === 'rfm') return <RfmScreen />;
  if (screen === 'capacity') return <HospitalScreen />;
  if (screen === 'adfunnel') return <AdFunnelScreen />;
  if (screen === 'riskreview') return <RiskScreen />;
  if (screen === 'rag') return <RagScreen />;
  if (screen === 'db') return <DbScreen />;
  if (screen === 'arch') return <ArchScreen />;
  if (screen === '3d') return <ThreeScreen />;
  return null;
}
