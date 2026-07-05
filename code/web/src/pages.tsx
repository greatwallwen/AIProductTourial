import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchIndex, fetchOpenapi, type IndexData } from './lib/api';
import { getProgress } from './progress';

const pad = (n: number) => String(n).padStart(2, '0');
const STAGES = ['采集', '治理', '洞察', '决策', '执行', '验收', '增长'];
const LAYERS = ['业务应用', '能力智能', '底座平台'];

// —— 首页：价值主张 + 学习路径 + 交互式数字化系统全景（从 /api/index 实时构建）——
export function Home() {
  const [idx, setIdx] = useState<IndexData | null>(null);
  useEffect(() => { fetchIndex().then(setIdx).catch(() => {}); }, []);
  const cells = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const c of (idx?.cases as any[]) || []) { const k = `${c.systemLayer}|${c.systemStage}`; (m[k] = m[k] || []).push(c); }
    return m;
  }, [idx]);
  const prog = idx ? getProgress(idx.cases.length) : null;
  const paths = [
    { name: '新手路径', desc: '从早会异常台入门，走一遍洞察→决策→执行', to: '/case/01', color: 'var(--accent)' },
    { name: '架构路径', desc: '数字化底座：向量库 / 关系库 / 子系统契约 / 3D', to: '/case/46', color: 'var(--accent2)' },
    { name: 'AI 路径', desc: '先玩概念实验室，再看 RAG / 知识治理案例', to: '/lab/tokenizer', color: 'var(--ok)' },
  ];
  return (
    <div className="page">
      <div className="topbar"><div><div className="crumb">数字化产品经理转型实操知识库</div><h1>把理论，做成一个能跑的数字化系统</h1>
        <div className="muted">先讲 AI 底层 / Loop / 架构 / 规范 / 设计，再用 {idx?.cases.length ?? ''} 个案例串成一套数字化系统的实操演示——真数据、真后端、真原型。</div></div></div>
      {prog && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`学习进度 ${prog.pct}%`}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(prog.pct / 100) * 188} 999`} transform="rotate(-90 36 36)" />
            <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">{prog.pct}%</text>
          </svg>
          <div>
            <div style={{ fontWeight: 650, color: 'var(--ink)' }}>学习进度：看过 {prog.viewed}/{prog.total} 案例 · 决策题答对 {prog.correct}</div>
            <div className="ov-top" style={{ marginTop: 6 }}>{prog.badges.length ? prog.badges.map((b) => <span key={b} className="chip soft">{b}</span>) : <span className="muted">浏览案例、玩概念游戏、答对「你来决策」来点亮成就 →</span>}</div>
          </div>
        </div>
      )}
      <div className="grid-cards" style={{ marginBottom: 20 }}>
        {paths.map((p) => (
          <NavLink key={p.name} to={p.to} className="ov-card" style={{ borderTop: `2px solid ${p.color}` }}>
            <div className="ov-title">{p.name}</div><div className="ov-meta">{p.desc}</div><div className="ov-ph">开始 →</div>
          </NavLink>
        ))}
      </div>
      <section className="card">
        <div className="card-h"><h2>数字化系统全景 · {idx?.cases.length ?? ''} 案例串成一个系统</h2><span className="muted">纵向三层 × 横向数据价值闭环 · 点节点进案例</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
            <thead><tr><th style={{ padding: 6 }}></th>{STAGES.map((s) => <th key={s} style={{ padding: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 650 }}>{s}</th>)}</tr></thead>
            <tbody>
              {LAYERS.map((L) => (
                <tr key={L}>
                  <td style={{ padding: 6, fontSize: 11.5, fontWeight: 700, color: L === '底座平台' ? 'var(--accent2)' : 'var(--ink)', whiteSpace: 'nowrap' }}>{L}</td>
                  {STAGES.map((S) => (
                    <td key={S} style={{ padding: 4, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 90 }}>
                      {(cells[`${L}|${S}`] || []).map((c) => (
                        <NavLink key={c.num} to={`/case/${pad(c.num)}`} className="chip" style={{ display: 'block', margin: '3px 0', fontSize: 10.5, textDecoration: 'none' }}>{pad(c.num)} {c.title.split('｜')[1]?.slice(0, 6)}</NavLink>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// —— 全站搜索：案例 + 概念实验室 + 原理 ——
const LAB = [['tokenizer', 'Tokenizer 实时分词', '§1.2'], ['context', 'Context Window 可视化', '§1.3'], ['rag', 'RAG Playground', '§1.3'], ['agent', 'ReAct 智能体游戏', '§1.6']];
export function Search() {
  const [idx, setIdx] = useState<IndexData | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { fetchIndex().then(setIdx).catch(() => {}); }, []);
  const kw = q.trim().toLowerCase();
  const cases = ((idx?.cases as any[]) || []).filter((c) => !kw || `${c.num} ${c.title} ${c.industry} ${c.saasType} ${c.systemStage} ${c.systemLayer}`.toLowerCase().includes(kw));
  const labs = LAB.filter((l) => !kw || l.join(' ').toLowerCase().includes(kw));
  return (
    <div className="page">
      <div className="topbar"><h1>搜索</h1></div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜案例 / 行业 / 环节 / 概念实验室…" aria-label="搜索"
        style={{ width: '100%', background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', padding: '10px 14px', fontSize: 15, marginBottom: 16 }} />
      {!!labs.length && <><div className="muted" style={{ margin: '8px 0' }}>概念实验室</div><div className="ov-top">{labs.map((l) => <NavLink key={l[0]} to={`/lab/${l[0]}`} className="chip soft" style={{ textDecoration: 'none' }}>{l[1]} {l[2]}</NavLink>)}</div></>}
      <div className="muted" style={{ margin: '14px 0 8px' }}>案例（{cases.length}）</div>
      <div className="grid-cards">
        {cases.map((c) => (
          <NavLink key={c.num} to={`/case/${pad(c.num)}`} className="ov-card">
            <div className="ov-top"><span className="chip">{pad(c.num)}</span><span className="chip ghost">{c.industry}</span></div>
            <div className="ov-title">{c.title.split('｜')[1]}</div><div className="ov-meta">{c.systemLayer} · {c.systemStage}</div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

// —— 原理索引：原理 → 演示它的案例（双向溯源）——
const SECTIONS: Record<string, string> = { '1': 'AI 核心概念底层', '2': '会 Loop 的产品工程', '3': '系统架构设计', '4': '工程规范', '5': '设计系统' };
export function PrincipleIndex() {
  const [idx, setIdx] = useState<any>(null);
  useEffect(() => { fetchIndex().then(setIdx).catch(() => {}); }, []);
  const map = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const c of (idx?.cases as any[]) || []) for (const code of (c.demonstrates || [])) (m[code] = m[code] || []).push(c);
    return m;
  }, [idx]);
  const codes = Object.keys(map).sort();
  return (
    <div className="page">
      <div className="topbar"><div><h1>原理索引 · 案例↔原理双向溯源</h1><div className="muted">点原理看「演示它的操作案例」；每个案例也标注它落地了哪条原理。</div></div></div>
      {codes.map((code) => (
        <section key={code} className="card" style={{ marginBottom: 10 }}>
          <div className="card-h"><h2><span style={{ color: 'var(--accent)' }}>§{code}</span> · {SECTIONS[code[0]] || ''}</h2><span className="muted">{map[code].length} 个案例演示</span></div>
          <div className="ov-top">{map[code].map((c) => <NavLink key={c.num} to={`/case/${pad(c.num)}`} className="chip soft" style={{ textDecoration: 'none' }}>{pad(c.num)} {c.title.split('｜')[1]?.slice(0, 8)}</NavLink>)}</div>
        </section>
      ))}
    </div>
  );
}

// —— 在线 API 文档（渲染 /api/openapi.json，呼应 §3 接口契约）——
export function ApiDocs() {
  const [spec, setSpec] = useState<any>(null);
  useEffect(() => { fetchOpenapi().then(setSpec).catch(() => {}); }, []);
  return (
    <div className="page">
      <div className="topbar"><div><h1>API 文档 · {spec?.info?.title || '…'}</h1><div className="muted">{spec?.info?.description} 一服务托管全部案例的真实接口（呼应 §3 接口契约）。</div></div></div>
      {spec && Object.entries(spec.paths).map(([path, ops]: any) => (
        <section key={path} className="card" style={{ marginBottom: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span className="badge ok">GET</span><span className="mono" style={{ color: 'var(--accent)' }}>{path}</span>
            <span className="muted">{ops.get?.summary}</span>
          </div>
          {!!(ops.get?.parameters || []).length && <div className="muted" style={{ marginTop: 6, fontSize: 11.5 }}>参数：{ops.get.parameters.map((p: any) => `${p.name}（${p.in}）`).join('、')}</div>}
        </section>
      ))}
    </div>
  );
}
