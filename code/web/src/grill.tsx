import { useState } from 'react';
import { Icon } from './Icon';
import { markGrill } from './progress';

// grill-me 苏格拉底追问的一步：题干 + 选项 + 正解下标 + 针对错答的追问(onWrong) + 对答后的深化(onRight)。
export type GrillStep = { q: string; options: string[]; correct: number; onWrong: string; onRight: string };
export type GrillState = { stage: number; picked: number | null; result: 'right' | 'wrong' | null; done: boolean };
export const grillInit: GrillState = { stage: 0, picked: null, result: null, done: false };

// 纯 reducer：选择 → 判定（错→停留本步、result=wrong、可重选；对→result=right；末步对→done）。
export function grillPick(steps: GrillStep[], s: GrillState, pick: number): GrillState {
  if (s.done || !steps[s.stage]) return s;
  const right = pick === steps[s.stage].correct;
  return { ...s, picked: pick, result: right ? 'right' : 'wrong', done: right && s.stage >= steps.length - 1 };
}
// 进阶：仅当上一步答对且未通关时推进到下一问并重置本步态。
export function grillNext(steps: GrillStep[], s: GrillState): GrillState {
  if (s.result !== 'right' || s.done) return s;
  if (s.stage >= steps.length - 1) return { ...s, done: true };
  return { stage: s.stage + 1, picked: null, result: null, done: false };
}

// 案例内「被追问」——grill-me 苏格拉底式层层追问（题锚本案真实数据/决策；答错即点破误区再让重答，答对深化再进阶）。
export function Grill({ data }: { data: any }) {
  const steps: GrillStep[] = data.grill || [];
  const [s, setS] = useState<GrillState>(grillInit);
  if (!steps.length) return null;
  const step = steps[s.stage];
  const pick = (i: number) => { const ns = grillPick(steps, s, i); setS(ns); if (ns.done) markGrill(data.num, true); };
  const next = () => setS(grillNext(steps, s));
  return (
    <section className="card">
      <div className="card-h"><h2><Icon name="gamepad" /> 被追问（grill-me）</h2><span className="muted">苏格拉底式层层追问 · 第 {s.stage + 1}/{steps.length} 问 · 答错即点破再重答</span></div>
      <div style={{ fontWeight: 650, color: 'var(--ink)', margin: '4px 0 10px' }}>{step.q}</div>
      <div className="ov-top">
        {step.options.map((o, i) => (
          <button key={i} className="chip" aria-pressed={s.picked === i} disabled={s.result === 'right'}
            onClick={() => pick(i)}
            style={{ cursor: s.result === 'right' ? 'default' : 'pointer', padding: '6px 12px',
              borderColor: s.picked === i ? (i === step.correct ? 'var(--ok)' : 'var(--bad)') : 'var(--border)',
              color: s.picked === i && i === step.correct ? 'var(--ok)' : undefined }}>
            {o}{s.picked === i && i === step.correct ? ' ✓' : ''}
          </button>
        ))}
      </div>
      {s.result === 'wrong' && (
        <div className="banner" style={{ marginTop: 12, color: 'var(--bad)', borderColor: 'var(--bad)' }}>✗ 再想想：{step.onWrong}</div>
      )}
      {s.result === 'right' && (
        <div className="banner" style={{ marginTop: 12, color: 'var(--ok)', borderColor: 'var(--ok)' }}>
          ✓ 对。{step.onRight}
          {!s.done && <button className="act-btn" style={{ marginLeft: 10 }} onClick={next}>继续追问 →</button>}
          {s.done && <b style={{ marginLeft: 10 }}>—— 追问通关，你已想透这条。</b>}
        </div>
      )}
    </section>
  );
}
