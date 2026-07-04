import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { fetchSearch, fetchDbQuery, fetchPoints3d, fetchHealth } from './lib/api';

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

// —— three.js 3D 散点（R3F）：调 /api/points3d 渲染真实经营数据点 ——
function Cloud({ points }: { points: Array<{ x: number; y: number; z: number; c: number }> }) {
  const ref = useRef<any>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.16; });
  const { positions, colors } = useMemo(() => {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y), zs = points.map((p) => p.z);
    const nrm = (v: number, a: number[]) => { const mn = Math.min(...a), mx = Math.max(...a); return ((v - mn) / ((mx - mn) || 1)) * 2 - 1; };
    const pal = [[0.2, 0.83, 0.6], [0.98, 0.75, 0.14], [0.4, 0.7, 1], [0.66, 0.33, 0.97], [0.94, 0.44, 0.44]];
    const pos = new Float32Array(points.length * 3), col = new Float32Array(points.length * 3);
    points.forEach((p, i) => { pos[i * 3] = nrm(p.x, xs); pos[i * 3 + 1] = nrm(p.y, ys); pos[i * 3 + 2] = nrm(p.z, zs); const c = pal[p.c % pal.length]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; });
    return { positions: pos, colors: col };
  }, [points]);
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}
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
        {d && hasWebGL && <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 50 }} gl={{ antialias: true }}>
          <ambientLight intensity={0.9} />
          <Cloud points={d.points} />
        </Canvas>}
        {d && !hasWebGL && <PseudoScatter points={d.points} />}
      </div>
    </section>
  );
}

export function SpecialScreen({ screen }: { screen: string }) {
  if (screen === 'rag') return <RagScreen />;
  if (screen === 'db') return <DbScreen />;
  if (screen === 'arch') return <ArchScreen />;
  if (screen === '3d') return <ThreeScreen />;
  return null;
}
