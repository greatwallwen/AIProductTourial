import { useEffect, useMemo, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { fetchTokenize, fetchSearch } from './lib/api';

// AI 概念实验室：把 §1 抽象概念做成可玩的真实交互（后端 /api/tokenize、/api/search 驱动）。

// —— Tokenizer 实时分词（§1.2）——
function Tokenizer() {
  const [text, setText] = useState('你好，今天天气怎么样？Hello AI Agent 2026');
  const [res, setRes] = useState<any>(null);
  useEffect(() => { const t = setTimeout(() => fetchTokenize(text).then(setRes).catch(() => {}), 200); return () => clearTimeout(t); }, [text]);
  const kindColor: Record<string, string> = { word: 'var(--accent)', cjk: 'var(--accent2)', cjk2: 'var(--ok)', punct: 'var(--muted)' };
  return (
    <div>
      <p className="muted">输入任意中英文，看它被切成一个个 <b>Token</b>、每个绑定一个 <b>Token ID</b>。这正是 §1.2 说的「编码=切分+映射」。</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="待分词文本"
        style={{ width: '100%', background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', padding: '10px 12px', fontSize: 14 }} />
      {res && <>
        <div style={{ display: 'flex', gap: 16, margin: '12px 0', flexWrap: 'wrap' }}>
          {[['Token 数', res.count], ['字符数', res.chars], ['量化比 字/Token', res.ratio]].map(([k, v]) => (
            <div key={k as string} className="kpi" style={{ minWidth: 130 }}><div className="kpi-name">{k}</div><div className="kpi-val">{v as number}</div></div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {res.tokens.map((t: any, i: number) => (
            <div key={i} style={{ border: `1px solid ${kindColor[t.kind] || 'var(--border)'}`, borderRadius: 8, padding: '4px 8px', background: 'var(--panel)' }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{t.text}</div>
              <div className="mono" style={{ fontSize: 10, color: kindColor[t.kind] || 'var(--muted)' }}>#{t.id}</div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// —— Context Window 可视化（§1.3）——
function ContextWindow() {
  const [text, setText] = useState('把这段话反复粘贴，模拟越来越长的对话历史，看它何时撑爆上下文窗口。');
  const [win, setWin] = useState(64);
  const [count, setCount] = useState(0);
  useEffect(() => { fetchTokenize(text).then((r) => setCount(r.count)).catch(() => {}); }, [text]);
  const used = count, cap = win, pct = Math.min(100, (used / cap) * 100), over = used > cap;
  return (
    <div>
      <p className="muted">大模型没有真记忆——每轮都把<b>完整历史</b>塞进 <b>Context</b>。窗口就那么大（这里模拟 {win} Token），塞满就会<b>截断</b>。这就是 §1.3、也是为什么需要 RAG。</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="上下文文本"
        style={{ width: '100%', background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', padding: '10px 12px', fontSize: 13 }} />
      <div style={{ margin: '12px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="muted">窗口容量</span>
        <input type="range" min={16} max={256} value={win} onChange={(e) => setWin(Number(e.target.value))} aria-label="窗口容量" style={{ flex: 1 }} />
        <span className="mono">{win} Token</span>
      </div>
      <div style={{ height: 30, borderRadius: 8, background: 'var(--panelSoft)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--bad)' : 'linear-gradient(90deg,var(--accent),var(--accent2))' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--ink)' }}>
          已用 {used} / {cap} Token {over && `· 超出 ${used - cap}，将被截断`}
        </div>
      </div>
    </div>
  );
}

// —— RAG Playground（§1.3）——
function RagPlayground() {
  const [q, setQ] = useState('product roadmap prioritization');
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const run = () => { setLoading(true); fetchSearch(q).then(setRes).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { run(); }, []);
  return (
    <div>
      <p className="muted">不把整本手册塞进模型，而是用向量库<b>只召回最相关的几段</b>（真实检索 deanpeters 语料）。这就是 §1.3 的 RAG——降本、聚焦、更准。</p>
      <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} aria-label="检索词"
          style={{ flex: 1, background: 'var(--panelSoft)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', padding: '8px 12px' }} />
        <button className="act-btn" onClick={run}>{loading ? '检索中…' : '检索'}</button>
      </div>
      <div className="comp-row" style={{ marginBottom: 10 }}>
        {['分片', '索引', `召回 top-${res?.recallN ?? 10}`, `重排 top-${res?.k ?? 3}`, '生成'].map((s, i) => (
          <span key={i} className="chip soft">{i + 1}·{s}</span>
        ))}
      </div>
      <div className="muted" style={{ marginBottom: 8 }}>语料 {res?.corpus ?? '…'} 篇 · <b>召回</b> {res?.recall?.length ?? 0} 条（cosine 粗排）→ <b>重排</b> {res?.reranked?.length ?? 0} 条（Cross-Encoder 精排）→ 生成</div>
      {(res?.reranked || res?.hits || []).map((h: any, i: number) => (
        <div key={i} className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="mono" style={{ color: 'var(--accent)' }}>{h.id}</span><span className="badge ok">重排 {h.rerank ?? h.score}</span></div>
          <div className="muted" style={{ marginTop: 4, fontSize: 11.5 }}>{h.snippet}</div>
        </div>
      ))}
    </div>
  );
}

// —— ReAct/Agent 互动游戏（§1.6）——
const STEPS = [
  { think: '要回答「我这儿下雨吗，要不要带伞」，先得知道我在哪。', tool: '定位工具', obs: '经度 121.4，纬度 31.2（上海）' },
  { think: '有了位置，去查这里的实时天气。', tool: '天气工具', obs: '小雨，降水概率 80%' },
  { think: '下雨了——按规则该找附近的雨伞店。', tool: '店铺工具', obs: '附近 3 家便利店有伞' },
  { think: '信息齐了，给出最终答复。', tool: '（结束）', obs: '带伞出门；就近的便利店可买伞。' },
];
function AgentGame() {
  const [i, setI] = useState(0);
  const done = i >= STEPS.length;
  return (
    <div>
      <p className="muted">Agent 不是一次答完，而是「<b>思考→调用工具→看结果→再思考</b>」循环推进（§1.6 的 ReAct）。点下一步，看它像人一样分步把任务干完。</p>
      <div className="card" style={{ marginBottom: 12 }}><b>目标</b>：帮我看看我当前位置要不要带伞，如果下雨就找附近能买伞的店。</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.slice(0, i).map((s, k) => (
          <div key={k} className="card" style={{ padding: '10px 12px', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 12 }}><span className="badge neutral">思考</span> {s.think}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}><span className="badge warn">调用 {s.tool}</span> → <span style={{ color: 'var(--ok)' }}>{s.obs}</span></div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {!done ? <button className="act-btn" onClick={() => setI(i + 1)}>下一步（第 {i + 1} 轮 ReAct）</button>
          : <button className="act-btn" onClick={() => setI(0)}>↺ 重新演示</button>}
        {done && <span className="badge ok" style={{ marginLeft: 10 }}>✓ 循环结束，任务完成</span>}
      </div>
    </div>
  );
}

const DEMOS: Record<string, { name: string; principle: string; el: () => JSX.Element }> = {
  tokenizer: { name: 'Tokenizer 实时分词', principle: '§1.2', el: Tokenizer },
  context: { name: 'Context Window 可视化', principle: '§1.3', el: ContextWindow },
  rag: { name: 'RAG Playground', principle: '§1.3', el: RagPlayground },
  agent: { name: 'ReAct 智能体游戏', principle: '§1.6', el: AgentGame },
};

export function LabPage() {
  const { demo } = useParams();
  const key = demo && DEMOS[demo] ? demo : 'tokenizer';
  const D = DEMOS[key];
  const El = D.el;
  return (
    <div className="page">
      <div className="topbar"><div><div className="crumb">AI 概念实验室 · 把 §1 底层概念变成可玩的真实交互</div><h1>{D.name}</h1><div className="demos">▹ 演示原理 {D.principle} · 后端真实驱动</div></div></div>
      <nav aria-label="实验室导航" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(DEMOS).map(([k, v]) => (
          <NavLink key={k} to={`/lab/${k}`} className="chip" style={{ padding: '6px 12px', textDecoration: 'none', background: k === key ? 'color-mix(in srgb,var(--accent) 20%,transparent)' : undefined, color: k === key ? 'var(--accent)' : undefined }}>{v.name}</NavLink>
        ))}
      </nav>
      <section className="card"><El /></section>
    </div>
  );
}
