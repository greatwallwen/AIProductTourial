import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { fetchSearch, fetchDbQuery, fetchHealth, fetchArch, fetchCredit, fetchRetail, fetchRfm, fetchGates } from './lib/api';

// 架构/向量库/PG 等案例的「真实后端」案例屏：全部 live 调后端接口。

// —— 向量库检索(RAG)：调 /api/search 展示命中片段与相似度 ——
function RagScreen() {
  const [q, setQ] = useState('铁路全长多少公里');
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
  const [group, setGroup] = useState<'station' | 'month'>('station');
  useEffect(() => { fetch(`/api/db/query?group=${group}`).then((r) => r.json()).then(setRes); }, [group]);
  return (
    <section className="card">
      <div className="card-h"><h2>关系库查询 · SQL</h2><span className="muted">{res?.engine ?? '…'} · /api/db/query</span></div>
      <div className="banner" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)', marginBottom: 8 }}>
        真表 <b>air_quality · {res?.rowCount ? Number(res.rowCount).toLocaleString('zh-CN') : '…'} 行</b>（UCI 北京 12 国控站真实逐时监测，CC BY 4.0）——「规模/复合索引/EXPLAIN」在真大表上才有说服力。
      </div>
      <div style={{ marginBottom: 8 }}>
        聚合维度：<button className={group === 'station' ? 'btn on' : 'btn'} onClick={() => setGroup('station')}>站点</button> <button className={group === 'month' ? 'btn on' : 'btn'} onClick={() => setGroup('month')}>月份</button>
      </div>
      <pre className="mono" style={{ background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 11.5, color: 'var(--accent)', overflowX: 'auto' }}>
{(res?.sql || '…') + ';   -- 真 node:sqlite，服务端回显实际执行 SQL'}
      </pre>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{group === 'station' ? '站点' : '月份'} dim</th><th>条数 n</th><th>平均PM2.5</th></tr></thead>
          <tbody>
            {(res?.rows || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.dim}</td><td className="mono">{r.n}</td><td className="mono">{Number(r.amt).toLocaleString('zh-CN')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
        <b>EXPLAIN QUERY PLAN（sqlite 真实执行计划，非文案）</b>
        <pre className="mono" style={{ fontSize: 11, margin: '6px 0 0' }}>{(res?.plan || []).map((p: any) => p.detail || JSON.stringify(p)).join('\n') || '…'}</pre>
        <div className="muted" style={{ fontSize: 11 }}>生产 PostgreSQL 对应 EXPLAIN (ANALYZE)——看 SCAN（全表扫）还是 SEARCH ... USING INDEX（走索引）。</div>
      </div>
      {res?.indexDemo && (
        <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <b>加索引前 / 后 · 同一条查询的真实执行计划（station=「{res.indexDemo.key}」）</b>
          <div className="muted" style={{ fontSize: 11, margin: '2px 0 6px' }}>{res.indexDemo.sql}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span className="mono" style={{ color: 'var(--bad)', fontSize: 11 }}>● 无索引 → 全表扫描</span>
              <pre className="mono" style={{ fontSize: 10.5, margin: '4px 0 0', color: 'var(--bad)', whiteSpace: 'pre-wrap' }}>{(res.indexDemo.before || []).map((p: any) => p.detail).join('\n')}</pre>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span className="mono" style={{ color: 'var(--ok)', fontSize: 11 }}>● 建索引后 → 走索引</span>
              <pre className="mono" style={{ fontSize: 10.5, margin: '4px 0 0', color: 'var(--ok)', whiteSpace: 'pre-wrap' }}>{(res.indexDemo.after || []).map((p: any) => p.detail).join('\n')}</pre>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}><Icon name="alert" size={12} /> 真实 14 万行大表上 SCAN↔SEARCH 对比更悬殊；生产千万行缺 (站点,时间) 复合索引就是全表扫描——这是「规模」的可观测证据，不是口号。「存下来」≠「查得动」。CROSS JOIN 可再演到千万级。</div>
        </div>
      )}
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
      {a?.ruoyi && (
        <section className="card">
          <div className="card-h"><h2>真实项目对照 · 若依 RuoYi-Cloud（国产开源微服务）</h2><span className="muted">MIT · pom + @FeignClient 确定性解析</span></div>
          <div className="banner" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)', marginBottom: 10 }}>
            本仓库 {subs.length} 个子系统是「小 dogfood」；若依有 <b>{a.ruoyi.moduleCount} 个真实模块</b>、{a.ruoyi.edgeCount} 条依赖边——量级差一档，但守边界的手段一样：<b>依赖单向 + 循环依赖 {a.ruoyi.cycles}</b>（真实项目分层同样干净）+ 显式接口契约。
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            <b>分层（common 基座 → 业务模块 → 网关）</b> · 部分真实依赖边：{a.ruoyi.edges.slice(0, 10).map((e: any, i: number) => <span key={i} className="chip soft" style={{ marginRight: 6 }}>{e.from}→{e.to}</span>)}
          </div>
          <div style={{ fontSize: 12.5 }}>
            <b>服务接口契约（@FeignClient，共 {a.ruoyi.feign.length}）：</b>
            {a.ruoyi.feign.map((f: any) => <div key={f.file} style={{ paddingLeft: 10, borderLeft: '3px solid var(--accent)', margin: '4px 0' }}><code>{f.file}</code> → 服务 <code>{f.service}</code>：{(f.methods || []).join(' / ') || '（契约方法）'}</div>)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}><Icon name="alert" size={12} /> 目录名骗不了门禁：真实项目靠「依赖方向单向 + 循环依赖=0 + Feign 显式契约」守分层，不是靠 routes/services 目录名。</div>
        </section>
      )}
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

// —— 大陆 P2P 信贷·信用画像分层专属 demo（案例02）：真实分层 + 放款转化 + 风险队列 + 文案信号（人人贷 CC0）——
const CREDIT_COLORS: Record<string, string> = { '优质': 'var(--ok)', '成长': 'var(--accent)', '待观察': 'var(--warn)', '薄档': 'var(--bad)' };
function CreditScreen() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchCredit().then(setD); }, []);
  if (!d) return <section className="card"><div className="muted">加载信用分层…</div></section>;
  const maxFund = Math.max(...d.segments.map((s: any) => s.fundRate), 1);
  const maxLim = Math.max(...d.scatter.map((p: any) => p.x), 1), maxHc = Math.max(...d.scatter.map((p: any) => p.y), 1);
  const realBanner = <div style={{background:"#064e3b",color:"#a7f3d0",padding:"6px 12px",borderRadius:8,marginBottom:10,fontSize:13}}>真实数据：人人贷 P2P 借贷记录（Harvard Dataverse · CC0 · 中国大陆）——放款成功/金额/额度/征信/文案为真实列，信用画像为规则派生分层。<b>标的=放款成功，非违约</b>，不可据此推断还款能力。</div>;
  return (
    <>
      <div className="banner" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>
      {realBanner}<Icon name="alert" /> 风险队列：<b>{d.riskCount.toLocaleString('zh-CN')}</b> 笔（{d.riskRate}%）为薄档/待观察（无征信或历史零成功）——高影响金融不自动放款，转人工复核。整体放款成功率 {d.fundRate}%。</div>
      {d.firstVsRepeat && (<>
        <div className="cols" style={{ marginBottom: 4 }}>
          {[['新客（历史成功=1）', d.firstVsRepeat.first, 'var(--warn)'], ['复借（历史成功≥2）', d.firstVsRepeat.repeat, 'var(--ok)']].map(([label, s, col]: any) => (
            <section key={label} className="card">
              <div className="card-h"><h2 style={{ fontSize: 14 }}>{label}</h2><span className="muted">{s.count.toLocaleString('zh-CN')} 笔</span></div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                <div><span className="muted">放款率</span><br /><b style={{ color: col, fontSize: 18 }}>{s.fundRate}%</b></div>
                <div><span className="muted">征信完整率</span><br /><b style={{ fontSize: 18 }}>{s.repRate}%</b></div>
                <div><span className="muted">平均借款额</span><br /><b style={{ fontSize: 18 }}>{s.avgAmount.toLocaleString('zh-CN')}</b></div>
              </div>
            </section>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, margin: '2px 0 10px', color: 'var(--warn)' }}><Icon name="alert" size={12} /> 新客 vs 复借是 P2P 风控最基本的细分（本真集历史成功次数 min=1，按数据真实切分，非臆造「首贷=0」）：驱动放款的因子不同——复借有历史行为可依，新客只能靠征信/额度/文案。差异化风控，别用一套规则套所有人。</div>
      </>)}
      <div className="cols">
        <section className="card">
          <div className="card-h"><h2>信用画像分层 · {d.total.toLocaleString('zh-CN')} 笔</h2><span className="muted">条长=该层放款成功率 · 反直觉：薄档反而最高</span></div>
          <div className="muted" style={{ fontSize: 11.5, margin: '2px 0 8px', color: 'var(--warn)' }}><Icon name="alert" size={12} /> 放款率沿画像层是「反」的（薄档最高、优质最低）——放款成功主要由借款规模驱动（小额易融），<b>不是信用/还款能力的度量</b>。画像分层用于风险处置（薄档→人工复核），不是用放款率给借款人排好坏。</div>
          {d.segments.map((s: any) => (
            <div key={s.name} style={{ margin: '9px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--ink)' }}><span style={{ color: CREDIT_COLORS[s.name] }}>●</span> {s.name}</span><span className="mono" style={{ color: 'var(--ink2)' }}>{s.count.toLocaleString('zh-CN')} 笔 · 放款率 {s.fundRate}% · 均额 {s.avgAmount.toLocaleString('zh-CN')}</span></div>
              <div style={{ height: 8, background: 'var(--panelSoft)', borderRadius: 4, marginTop: 3 }}><div style={{ width: `${(s.fundRate / maxFund) * 100}%`, height: '100%', background: CREDIT_COLORS[s.name] || 'var(--accent)', borderRadius: 4 }} /></div>
            </div>
          ))}
          <div className="card-h" style={{ marginTop: 12 }}><h2 style={{ fontSize: 13 }}>文案长度 → 放款成功率</h2><span className="muted">短文案放款率反而高——多为小额（混淆·相关≠因果）</span></div>
          {d.textSignal.map((t: any) => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '4px 0', color: 'var(--ink2)' }}><span>{t.label}</span><span className="mono">{t.count.toLocaleString('zh-CN')} 笔 · {t.fundRate}%</span></div>
          ))}
        </section>
        <section className="card">
          <div className="card-h"><h2>授信额度 × 历史成功次数（色=信用画像）</h2><span className="muted">左下=低额+零历史 → 薄档区</span></div>
          <svg className="chart" viewBox="0 0 560 300">
            <line x1="42" y1="268" x2="552" y2="268" stroke="var(--border)" /><line x1="42" y1="18" x2="42" y2="268" stroke="var(--border)" />
            <text x="300" y="290" className="axis">授信额度 →</text><text x="16" y="150" className="axis" transform="rotate(-90 16 150)">历史成功次数 →</text>
            {d.scatter.map((p: any, i: number) => <circle key={i} cx={42 + (p.x / maxLim) * 508} cy={268 - (p.y / maxHc) * 246} r="3.2" fill={CREDIT_COLORS[p.seg] || 'var(--muted)'} opacity="0.72" />)}
          </svg>
          <div className="ov-top" style={{ marginTop: 8 }}>{Object.entries(CREDIT_COLORS).map(([n, c]) => <span key={n} className="chip" style={{ borderColor: c }}><span style={{ color: c }}>●</span> {n}</span>)}</div>
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

// —— 零售经营方案专属 demo（案例03 综合闭环）：从真实数据合成「现状→问题→动作→责任」的可交付方案 ——
const RFM_COLORS: Record<string, string> = { '重要价值': 'var(--ok)', '高价值流失': 'var(--bad)', '一般保持': 'var(--accent)', '流失预警': 'var(--warn)', '普通': 'var(--muted)' };
function PlanScreen() {
  const [d, setD] = useState<any>(null);
  const [rf, setRf] = useState<any>(null);
  useEffect(() => { fetchRetail().then(setD); fetchRfm().then(setRf).catch(() => {}); }, []);
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
      {rf && rf.segments?.length && (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="card-h"><h2>真实 RFM 客户分层（{rf.total} 位客户 · UCI 真算）</h2><span className="muted">R 最近购买天数 / F 购买次数 / M 总消费</span></div>
          <div className="banner" style={{ color: 'var(--bad)', borderColor: 'var(--bad)', marginBottom: 10 }}>
            <Icon name="alert" size={12} /> 会员经营的抓手是「<b>高价值流失</b>」：{rf.churnCount} 位（{rf.churnRate}%）——消费高（M 大）却久未回购（R 大），最该抢救；别把「一般保持/普通」的大盘当重点。
          </div>
          {(() => { const max = Math.max(...rf.segments.map((x: any) => x.count)); return rf.segments.map((s: any) => (
            <div key={s.name} style={{ margin: '6px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: RFM_COLORS[s.name] || 'var(--ink)' }}>{s.name} · {s.count} 人</span>
                <span className="mono muted">R{s.avgR}天 · F{s.avgF}次 · M¥{s.avgM.toLocaleString('zh-CN')}</span>
              </div>
              <div style={{ height: 8, background: 'var(--panelSoft)', borderRadius: 5, overflow: 'hidden', marginTop: 3 }}>
                <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: RFM_COLORS[s.name] || 'var(--accent)' }} />
              </div>
            </div>
          )); })()}
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{rf.note}</div>
        </section>
      )}
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
  const [g, setG] = useState<any>(null);
  useEffect(() => { fetchGates().then(setG).catch(() => setG({ error: true })); }, []);
  const gatePanel = g && !g.error ? (
    <div style={{border:'1px solid #334155',borderRadius:10,padding:'10px 14px',margin:'10px 0',background:g.green?'#052e16':'#450a0a'}}>
      <b>第⑦步·活体门禁（此刻真跑）</b>：verify {g.verify.fail===0?'全绿':`失败 ${g.verify.fail} 项`}（断言点 {g.verify.badPoints} / 运行检查 {g.verify.checks}——两个口径都真）；eval hit@1 {g.evalGate.score}%（基线 {g.evalGate.baseline}%，{g.evalGate.pass?'过':'未过'}）
      {g.verify.fails?.length ? <div style={{marginTop:6,fontSize:12}}>红在哪：{g.verify.fails.slice(0,3).join('；')}</div> : null}
      <div style={{fontSize:12,opacity:.8,marginTop:4}}>试试「种一个错」（如把某案例 fields 改成不存在的列，跑 build 后刷新本页）——门禁会当场变红并指出位置；改回即恢复全绿。</div>
    </div>) : null;
  return (
    <>
      <section className="card">
        <div className="card-h">
      {gatePanel}<h2>SDD 系统建造走查 · dogfood</h2><span className="muted">把「本平台自己」当被建造的系统，走一遍规格驱动八步 · 工件全对到本仓库</span></div>
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
      {data?.ds && (
        <section className="card">
          <div className="card-h"><h2>真实研发效能对照 · {data.ds.source}</h2><span className="muted">{data.ds.license}</span></div>
          <div className="banner" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)', marginBottom: 10 }}>
            本案「SDD 八步」是把本仓库自己当被建系统的 dogfood；对照一个真实大项目——海豚调度近 100 次 CI 的<b>门禁通过率 {data.ds.ci.passRate}%</b>（{data.ds.ci.success} 成功 / {data.ds.ci.failure} 失败 / {data.ds.ci.action_required} 待人工审批）、PR 合并率 {data.ds.prMergeRate}%。第⑦步那条「门禁」腿，在真实项目里就是这样的红绿曲线。
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)' }}>近 {data.ds.prTotal} 个 PR 类型分布：{Object.entries(data.ds.prByType).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => <span key={k} className="chip soft" style={{ marginRight: 6 }}>{k} {v}</span>)}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>门禁失败/待审批=真实的「返工/把关」信号；规格→实现→门禁的节奏，大项目也靠这条守住，不是靠 prompt 一把过。</div>
        </section>
      )}
    </>
  );
}


// v18-P3 案54：仓库事件总线——真实 git 事件流时间线 + 版本聚合（事件溯源最小标本）
function EventBusScreen({ data }: { data: any }) {
  const mx = Math.max(1, ...(data?.chart?.data || []).map((d: any) => d.value));
  return (
    <section className="card">
      <div className="card-h"><h2>仓库事件总线 · git 真实事件流</h2><span className="muted">不可变日志 · 状态可重放（§7.2 / §9.4）</span></div>
      {/* v20：统一用标准 KPI 组件类名（.kpis/.kpi-name/.kpi-val），截图边车传感器按此抽取名值对 */}
      <div className="kpis" style={{ marginBottom: 10 }}>
        {(data?.kpis || []).map((k: any) => (<div key={k.name} className="kpi"><div className="kpi-name">{k.name}</div><div className="kpi-val">{typeof k.value === 'number' ? k.value.toLocaleString('zh-CN') : k.value}<span className="kpi-unit">{k.unit}</span></div></div>))}
      </div>
      <div style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 12 }}>{data?.chart?.by}</b>
        {(data?.chart?.data || []).map((d: any) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
            <span className="mono" style={{ width: 52, fontSize: 11 }}>{d.label}</span>
            <div style={{ height: 10, width: `${Math.round(d.value / mx * 70)}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.85 }} />
            <span className="mono" style={{ fontSize: 11 }}>{d.value}</span>
          </div>))}
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>#</th><th>类型</th><th>哈希</th><th>时间</th><th>事件（提交标题）</th></tr></thead>
        <tbody>{(data?.queue || []).map((q: any) => (<tr key={q.id}><td>{q.id}</td><td>{q.state}</td><td className="mono">{q.fields?.哈希 ?? '—'}</td><td className="mono">{q.fields?.时间 ?? '—'}</td><td>{q.fields?.标题 ?? '—'}</td></tr>))}</tbody>
      </table></div>
      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>数据=本仓库 git log 真实事件（构建期读取，不可变）；「门禁检查项」为当前 verify 源码断言点计数。</div>
      {data?.nacos && (
        <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <b>大型项目对照 · {data.nacos.source}（{data.nacos.license}）</b>
          <div className="banner" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)', margin: '8px 0' }}>
            本仓库是「小事件流」（{data.nacos.selfEventCount} 提交）；nacos 近 <b>{data.nacos.eventCount} 个真实提交事件</b>、跨 {data.nacos.spanDays} 天、{data.nacos.mergeCount} 次合并——量级差几档，但事件溯源的铁律一样：<b>只读 + 不可变 + 可重放</b>，改公共历史=总线失信。
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6 }}>类型分布：{Object.entries(data.nacos.byType).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6).map(([k, v]: any) => <span key={k} className="chip soft" style={{ marginRight: 6 }}>{k} {v}</span>)}</div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>哈希</th><th>父提交数</th><th>事件（提交标题）</th></tr></thead>
            <tbody>{data.nacos.sample.map((e: any) => <tr key={e.h}><td className="mono">{e.h}</td><td className="mono">{e.parents}{e.parents > 1 ? '（合并）' : ''}</td><td>{e.subject}</td></tr>)}</tbody>
          </table></div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>父提交数=事件 DAG 的入边；≥2 即合并事件。同一套「重放到任意版本」在大项目上同样成立。</div>
        </div>
      )}
    </section>
  );
}

export function SpecialScreen({ screen, data }: { screen: string; data?: any }) {
  if (screen === 'buildwalk') return <BuildWalkScreen data={data} />;
  if (screen === 'eval') return <DogfoodScreen data={data} kind={screen} />;
  if (screen === 'eventbus') return <EventBusScreen data={data} />;
  if (screen === 'credit') return <CreditScreen />;
  if (screen === 'retail') return <RetailScreen />;
  if (screen === 'plan') return <PlanScreen />;
  if (screen === 'rag') return <RagScreen />;
  if (screen === 'db') return <DbScreen />;
  if (screen === 'arch') return <ArchScreen />;
  return null;
}
