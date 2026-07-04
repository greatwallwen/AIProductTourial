import { useMemo, useState } from 'react';

// 休闲小游戏：AI 概念配对（把 §1 概念和它的一句话解释连起来）。纯前端、真实概念、寓教于乐。
const PAIRS = [
  { c: 'Token', d: '文本最小计量单位，1 个≈1.5~2 汉字' },
  { c: 'Context', d: '单次运算的全部输入，模型的临时记忆' },
  { c: 'RAG', d: '先检索高相关片段，再据此生成答案' },
  { c: 'Embedding', d: '把文本转成向量，语义近则向量近' },
  { c: 'Agent', d: '思考→调用工具→观察→再思考的循环' },
  { c: 'MCP', d: '工具统一接入标准，类比手机 Type-C' },
];

export function GamePage() {
  // 打乱右侧解释（确定性交错，避免随机导致截图不稳定）
  const defs = useMemo(() => PAIRS.map((_, i) => PAIRS[(i * 5 + 2) % PAIRS.length]), []);
  const [sel, setSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const done = Object.keys(matched).length === PAIRS.length;
  const clickDef = (concept: string) => {
    if (!sel || matched[sel]) return;
    setTries((t) => t + 1);
    if (concept === sel) { setMatched((m) => ({ ...m, [sel]: true })); setSel(null); setWrong(null); }
    else { setWrong(concept); setTimeout(() => setWrong(null), 500); }
  };
  return (
    <div className="page">
      <div className="topbar"><div><div className="crumb">概念实验室 · 休闲小游戏</div><h1>AI 概念配对</h1>
        <div className="muted">左边点一个概念，再点右边它的解释——全部连对即通关。寓教于乐地记住 §1。</div></div>
        <div>{done ? <span className="badge ok">🏆 通关！用了 {tries} 次尝试</span> : <span className="badge neutral">已配对 {Object.keys(matched).length}/{PAIRS.length}</span>}</div>
      </div>
      <div className="cols" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <section className="card">
          <div className="card-h"><h2>概念</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PAIRS.map((p) => (
              <button key={p.c} disabled={matched[p.c]} onClick={() => setSel(p.c)} aria-pressed={sel === p.c}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 650, cursor: matched[p.c] ? 'default' : 'pointer', fontFamily: 'inherit',
                  background: matched[p.c] ? 'color-mix(in srgb,var(--ok) 16%,transparent)' : sel === p.c ? 'color-mix(in srgb,var(--accent) 18%,transparent)' : 'var(--panelSoft)',
                  border: `1px solid ${matched[p.c] ? 'var(--ok)' : sel === p.c ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--ink)' }}>
                {p.c}{matched[p.c] ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h2>解释</h2><span className="muted">{sel ? `已选「${sel}」，点它的解释` : '先点左边一个概念'}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {defs.map((p) => (
              <button key={p.c} disabled={matched[p.c]} onClick={() => clickDef(p.c)}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, fontSize: 13, cursor: matched[p.c] ? 'default' : 'pointer', fontFamily: 'inherit',
                  background: matched[p.c] ? 'color-mix(in srgb,var(--ok) 14%,transparent)' : wrong === p.c ? 'color-mix(in srgb,var(--bad) 18%,transparent)' : 'var(--panelSoft)',
                  border: `1px solid ${matched[p.c] ? 'var(--ok)' : wrong === p.c ? 'var(--bad)' : 'var(--border)'}`, color: 'var(--ink2)' }}>
                {p.d}{matched[p.c] ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
