import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { fetchSearch, fetchDbQuery, fetchHealth, fetchArch, fetchRfm, fetchRetail } from './lib/api';
// three.js 独立 chunk，仅在渲染 3D 案例时动态加载（首屏不含 three）

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
  const [a, setA] = useState<any>(null);
  useEffect(() => { fetchArch().then(setA); }, []);
  const subs: Array<{ name: string; desc: string }> = a?.subsystems || [];
  const edges: Array<{ from: string; to: string }> = a?.edges || [];
  return (
    <>
      <section className="card">
        <div className="card-h"><h2>子系统分解 · 真实依赖（C4 容器）</h2><span className="muted">dogfood · /api/arch 实时扫 code/server 的真实 import</span></div>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
          {subs.map((s) => (
            <div key={s.name} className="kpi"><div className="kpi-name mono" style={{ color: 'var(--accent)' }}>code/server/{s.name}</div><div style={{ fontSize: 12, marginTop: 4 }}>{s.desc}</div></div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink2)' }}>
          <b>真实依赖边（{edges.length}）：</b>{edges.map((e, i) => <span key={i} className="chip soft" style={{ marginRight: 6 }}>{e.from} → {e.to}</span>)}
        </div>
        <div className="banner" style={{ marginTop: 12, color: a && a.cycles === 0 ? 'var(--ok)' : 'var(--bad)', borderColor: a && a.cycles === 0 ? 'var(--ok)' : 'var(--bad)' }}>
          {a ? <><Icon name="alert" /> 循环依赖检测：{a.cycles} 处{a.cycles === 0 ? '（架构守护通过：分层单向依赖）' : '（越界！需拆解）'}</> : '…'}
        </div>
      </section>
      {a && (
        <section className="card">
          <div className="card-h"><h2>接口契约 + ADR（真实工件）</h2><span className="muted">§3.4 契约即代码 · §3.5 决策留痕</span></div>
          <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>
            <div><b>错误信封</b>：<code>{a.contract?.envelope}</code></div>
            <div><b>幂等</b>：{a.contract?.idempotent}</div>
            <div><b>契约即代码</b>：{a.contract?.openapi}</div>
            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '3px solid var(--accent)' }}><b>{a.adr?.id} · {a.adr?.title}</b><br /><span style={{ color: 'var(--ink2)' }}>为什么：{a.adr?.why}</span></div>
          </div>
        </section>
      )}
    </>
  );
}

// —— 航空会员 RFM 专属 demo（案例30）：真实分层 + 高价值流失预警 + R×F 散点 ——
const SEG_COLORS: Record<string, string> = { '重要价值': 'var(--ok)', '高价值流失': 'var(--bad)', '重要保持': 'var(--accent)', '重要发展': 'var(--accent2)', '一般维持': 'var(--muted)', '流失预警': 'var(--warn)' };
function RfmScreen() {
  // v17 P0-1：本案数据为教学合成（固定种子），页面须明示
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchRfm().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载 RFM…</div></section>;
  const maxSpend = Math.max(...d.segments.map((s: any) => s.avgSpend));
  const maxR = Math.max(...d.scatter.map((p: any) => p.x), 1), maxF = Math.max(...d.scatter.map((p: any) => p.y), 1);
  const synthBanner = <div style={{background:"#7c2d12",color:"#fde68a",padding:"6px 12px",borderRadius:8,marginBottom:10,fontSize:13}}>教学合成数据（固定种子）——分层与效应为教学而设，非真实航司业务。设计说明：dataset/design/case_30.md</div>;
  return (
    <>
      <div className="banner" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>
      {synthBanner}<Icon name="alert" /> 高价值流失预警：<b>{d.churnRisk}</b> 名会员（{d.churnRate}%）年消费居前列却已久未乘机（R 偏大）——过去高价值、正在流失，最该优先干预。</div>
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

// —— 零售早会经营专属 demo（案例01）：品类经营 + 异常订单 triage，早会即行动 ——
function RetailScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchRetail().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载经营数据…</div></section>;
  const maxRev = Math.max(...d.cats.map((x: any) => x.revenue), 1);
  return (
    <>
      <div className="banner" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>{d.total} 单 · 异常 <b>{d.anomCount}</b> 单。早会看什么？先看品类经营（谁贡献收入、谁毛利偏低、谁异常高发），再把大额异常当场派人跟进——看板要变行动。</div>
      <div className="cols">
        <section className="card">
          <div className="card-h"><h2>品类经营（按销售额）</h2><span className="muted">收入(真实) · 均毛利(教学合成) · 异常率(真实退货信号·教学过采样)</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>品类</th><th>销售额（条）</th><th>均毛利</th><th>异常率</th></tr></thead>
              <tbody>
                {d.cats.map((x: any) => (
                  <tr key={x.name}>
                    <td style={{ color: 'var(--ink)' }}>{x.name}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: `${(x.revenue / maxRev) * 80}px`, height: 8, background: 'var(--accent)', borderRadius: 4 }} /><span className="mono">{x.revenue.toLocaleString('zh-CN')}</span></div></td>
                    <td><span className="mono" style={{ color: x.avgMargin < 32 ? 'var(--warn)' : 'var(--ok)' }}>{x.avgMargin}%</span></td>
                    <td><span className="mono" style={{ color: x.anomRate > 20 ? 'var(--bad)' : 'var(--ink2)' }}>{x.anomRate}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h2>大额异常订单 · 当场派单</h2><span className="muted">按金额 Top8</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>SKU</th><th>品类</th><th>区域</th><th>金额</th><th>异常</th><th>责任</th></tr></thead>
              <tbody>
                {d.triage.map((t: any, i: number) => (
                  <tr key={i}><td className="mono cell">{t.sku}</td><td>{t.cat}</td><td>{t.region}</td><td className="mono">{Math.round(t.amt).toLocaleString('zh-CN')}</td><td><span className="badge warn">{t.reason}</span></td><td><span className="chip owner">{t.resp || '—'}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

// —— 零售经营方案专属 demo（案例41 综合闭环）：从真实数据合成「现状→问题→动作→责任」的可交付方案 ——
function PlanScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchRetail().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">合成经营方案…</div></section>;
  const byRev = [...d.cats].sort((a: any, b: any) => b.revenue - a.revenue);
  const byMargin = [...d.cats].sort((a: any, b: any) => a.avgMargin - b.avgMargin);
  const byAnom = [...d.cats].sort((a: any, b: any) => b.anomRate - a.anomRate);
  const actions = [
    { q: `${byMargin[0].name} 毛利最低（${byMargin[0].avgMargin}%）`, a: `复盘 ${byMargin[0].name} 定价与采购成本，目标毛利 +2pct`, owner: '产品-王' },
    { q: `${byAnom[0].name} 异常率最高（${byAnom[0].anomRate}%）`, a: `治理 ${byAnom[0].name} 异常订单，压降异常率至 15% 以下`, owner: '运营-李' },
    { q: `${byRev[0].name} 是收入支柱（${byRev[0].revenue.toLocaleString('zh-CN')}）`, a: `保供 ${byRev[0].name}，避免缺货丢单，稳住基本盘`, owner: '供应链-孙' },
  ];
  return (
    <>
      <div className="banner" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)' }}>综合闭环：把 {d.total} 单经营数据端到端合成一份<b>可验收的经营方案</b>——不是给一堆图，而是「现状→问题→动作→责任」，每个动作有人有目标。</div>
      <section className="card">
        <div className="card-h"><h2>经营现状（真实数据）</h2></div>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
          {[['收入支柱(真实)', byRev[0].name, byRev[0].revenue.toLocaleString('zh-CN'), 'var(--ok)'], ['毛利洼地(教学合成)', byMargin[0].name, byMargin[0].avgMargin + '%', 'var(--warn)'], ['退货高发(真实)', byAnom[0].name, byAnom[0].anomRate + '%', 'var(--bad)'], ['异常订单(真实)', '合计', d.anomCount + ' 单', 'var(--accent)']].map((x: any) => (
            <div key={x[0]} className="kpi"><div className="kpi-name">{x[0]}</div><div className="kpi-val" style={{ fontSize: 18 }}>{x[1]}</div><div className="mono" style={{ color: x[3], fontSize: 12 }}>{x[2]}</div></div>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-h"><h2>改进动作（问题 → 动作 → 责任）</h2><span className="muted">可验收</span></div>
        {actions.map((x, i) => (
          <div key={i} className="card" style={{ marginBottom: 8, padding: '10px 12px', borderLeft: '3px solid var(--accent2)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink)' }}><Icon name="alert" /> {x.q}</div>
            <div style={{ fontSize: 12.5, marginTop: 5 }}>→ {x.a} <span className="chip owner" style={{ marginLeft: 8 }}>{x.owner}</span></div>
          </div>
        ))}
      </section>
    </>
  );
}

// —— dogfood 三案（48 CI 分诊 / 49 RAG 评测 / 50 交付门禁）：直接用已算好的真实 caseData（源=本仓库自身），按镜头换框架 ——
function DogfoodScreen({ data, kind }: { data: any; kind: string }) {
  const meta: Record<string, { title: string; src: string; note: string; qh: string }> = {
    triage: { title: 'CI 失败分诊台', src: 'code/server/tests · verify · routes/api.ts', note: '数据来自本仓库自身——测试断言、接口契约、校验检查项、后端模块。研发/项目镜头的 dogfood：把「红了」变成「哪里红、谁负责」。', qh: '待分诊的接口契约（失败会落到这里）' },
    eval: { title: 'RAG 回答评测台', src: 'skills/external/pm-skills-deanpeters 语料 + 标注评测集', note: '离线用标注评测集 × 真实语料算「覆盖深度命中率」——产品/研发镜头的 evals（本书称「当前最缺的技能」）。薄覆盖的问题就是要补语料的地方。', qh: '评测问题 · 覆盖篇数 · 是否通过' },
    gates: { title: '交付门禁看板', src: 'verify_course_package.mjs 检查与守卫 + 案例/角色覆盖', note: '本书自己的发布门禁：每一项检查、每一条守卫都列成可自动核对的关卡——项目/产品镜头，门禁即 evals 即验收。', qh: '发布门禁项 · 状态 · 责任' },
  };
  const m = meta[kind] || meta.gates;
  const kpis = data?.kpis || []; const queue = data?.queue || []; const fields = data?.fields || [];
  return (
    <>
      <section className="card">
        <div className="card-h"><h2>{m.title} · dogfood</h2><span className="muted">真实来源 {m.src}</span></div>
        <div className="muted" style={{ margin: '2px 0 12px' }}>{m.note}</div>
        <div className="kpis">{kpis.map((k: any, i: number) => (
          <div key={i} className="kpi"><div className="kpi-name">{k.name}</div><div className="kpi-val">{typeof k.value === 'number' ? k.value.toLocaleString('zh-CN') : k.value}<span className="kpi-unit">{k.unit}</span></div></div>
        ))}</div>
      </section>
      <section className="card">
        <div className="card-h"><h2>{m.qh}</h2><span className="muted">{queue.length} 项 · 全部真实数据行</span></div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr>{fields.map((f: string) => <th key={f}>{f}</th>)}<th>状态</th><th>责任</th></tr></thead>
          <tbody>{queue.map((q: any) => (
            <tr key={q.id}>{fields.map((f: string) => <td key={f}>{String(q.fields?.[f] ?? '—')}</td>)}<td><span className="chip soft">{q.state}</span></td><td>{q.owner || '—'}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  );
}

// —— 旗舰 51：SDD 系统建造走查（把「本平台自己」当被建造系统，走规格驱动八步，工件对到真仓库）——
function BuildWalkScreen({ data }: { data: any }) {
  const kpis = data?.kpis || []; const steps = data?.queue || [];
  return (
    <>
      <section className="card">
        <div className="card-h"><h2>SDD 系统建造走查 · dogfood</h2><span className="muted">把「本平台自己」当被建造的系统，走一遍规格驱动八步 · 工件全对到本仓库</span></div>
        <div className="muted" style={{ margin: '2px 0 12px' }}>几个 prompt 建不成中大型系统——每一步都要一份可追溯、可验收的真实工件。数据来自 rules/ · docs/_source · case_definitions · verify · 架构图。</div>
        <div className="kpis">{kpis.map((k: any, i: number) => <div key={i} className="kpi"><div className="kpi-name">{k.name}</div><div className="kpi-val">{typeof k.value === 'number' ? k.value.toLocaleString('zh-CN') : k.value}<span className="kpi-unit">{k.unit}</span></div></div>)}</div>
      </section>
      <section className="card">
        <div className="card-h"><h2>SDD 八步流水线</h2><span className="muted">每步 → 一份真实工件 → 状态</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((s: any) => {
            const f = s.fields || {}; const human = /人工/.test(s.state); const done = /已|三绿/.test(s.state);
            const col = human ? 'var(--warn)' : done ? 'var(--ok)' : 'var(--accent)';
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--panelSoft)', borderLeft: `3px solid ${col}` }}>
                <div style={{ fontWeight: 750, color: col, minWidth: 72 }}>{f['步骤']}</div>
                <div style={{ flex: 1 }}><code style={{ fontSize: 12 }}>{f['工件']}</code><div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>{f['产出']}</div></div>
                <span className="chip soft" style={{ color: col }}>{s.state}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function SpecialScreen({ screen, data }: { screen: string; data?: any }) {
  if (screen === 'buildwalk') return <BuildWalkScreen data={data} />;
  if (screen === 'eval') return <DogfoodScreen data={data} kind={screen} />;
  if (screen === 'rfm') return <RfmScreen />;
  if (screen === 'retail') return <RetailScreen />;
  if (screen === 'plan') return <PlanScreen />;
  if (screen === 'rag') return <RagScreen />;
  if (screen === 'db') return <DbScreen />;
  if (screen === 'arch') return <ArchScreen />;
  return null;
}
