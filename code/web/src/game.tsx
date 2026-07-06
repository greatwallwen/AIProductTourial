import { useMemo, useState } from 'react';

// 休闲小游戏：两种模式，纯前端、真实内容、寓教于乐。
// ① AI 概念配对（把 §1 概念和它的一句话解释连起来）
const CONCEPT_PAIRS = [
  { c: 'Token', d: '文本最小计量单位，1 个≈1.5~2 汉字' },
  { c: 'Context', d: '单次运算的全部输入，模型的临时记忆' },
  { c: 'RAG', d: '先检索高相关片段，再据此生成答案' },
  { c: 'Embedding', d: '把文本转成向量，语义近则向量近' },
  { c: 'Agent', d: '思考→调用工具→观察→再思考的循环' },
  { c: 'MCP', d: '工具统一接入标准，类比手机 Type-C' },
];
// ② 哪个镜头（把案例连到它更偏的角色镜头，体会「一个操作模型、三个镜头」）
const LENS_PAIRS = [
  { c: 'CI 失败分诊（案例 48）', d: '研发镜头 · build/test loop：让失败自己归类、指责任' },
  { c: 'RAG 评测台（案例 49）', d: '产品镜头 · eval loop：用评测集量化「答得准不准」' },
  { c: '交付门禁看板（案例 50）', d: '项目镜头 · governance：能不能发布靠可核对的关卡' },
  { c: '金融复核（案例 28）', d: '产品×项目：高影响域「系统建议 + 人工复核」' },
  { c: '关系库架构（案例 45）', d: '研发镜头：把经营数据落成可查询的底座' },
  { c: '早会异常订单（案例 01）', d: '产品镜头：把昨天的信号今天就派出去' },
];

function MatchGame({ pairs }: { pairs: { c: string; d: string }[] }) {
  // 打乱右侧（确定性交错，避免随机导致截图不稳定）
  const defs = useMemo(() => pairs.map((_, i) => pairs[(i * 5 + 2) % pairs.length]), [pairs]);
  const [sel, setSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const done = Object.keys(matched).length === pairs.length;
  const clickDef = (concept: string) => {
    if (!sel || matched[sel]) return;
    setTries((t) => t + 1);
    if (concept === sel) { setMatched((m) => ({ ...m, [sel]: true })); setSel(null); setWrong(null); }
    else { setWrong(concept); setTimeout(() => setWrong(null), 500); }
  };
  return (
    <>
      <div style={{ margin: '0 0 12px' }}>{done ? <span className="badge ok">通关！用了 {tries} 次尝试</span> : <span className="badge neutral">已配对 {Object.keys(matched).length}/{pairs.length}</span>}</div>
      <div className="cols" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <section className="card">
          <div className="card-h"><h2>左侧</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pairs.map((p) => (
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
          <div className="card-h"><h2>连到它</h2><span className="muted">{sel ? `已选「${sel}」，点它的对应项` : '先点左边一个'}</span></div>
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
    </>
  );
}

export function GamePage() {
  const [mode, setMode] = useState<'concept' | 'lens'>('concept');
  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="crumb">概念实验室 · 休闲小游戏</div>
          <h1>{mode === 'concept' ? 'AI 概念配对' : '哪个镜头？'}</h1>
          <div className="muted">{mode === 'concept' ? '左点概念、右点解释——全连对即通关，寓教于乐记住 §1。' : '把每个案例连到它更偏的角色镜头（研发/产品/项目），体会「一个操作模型、三个镜头」。'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'chip ' + (mode === 'concept' ? 'soft' : 'ghost')} onClick={() => setMode('concept')} style={{ cursor: 'pointer', fontFamily: 'inherit' }}>概念配对</button>
          <button className={'chip ' + (mode === 'lens' ? 'soft' : 'ghost')} onClick={() => setMode('lens')} style={{ cursor: 'pointer', fontFamily: 'inherit' }}>哪个镜头</button>
        </div>
      </div>
      <MatchGame key={mode} pairs={mode === 'concept' ? CONCEPT_PAIRS : LENS_PAIRS} />
    </div>
  );
}
