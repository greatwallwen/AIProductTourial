import { useState } from 'react';
import { Icon } from './Icon';
import { markQuiz } from './progress';

// 案例内「你来决策」——基于本案例真实异常队列的责任分派题（数据真实、非编造）。
export function Challenge({ data }: { data: any }) {
  const q = data.queue?.[0];
  const owners = [...new Set((data.queue || []).map((x: any) => x.owner).filter(Boolean))] as string[];
  const [picked, setPicked] = useState<string | null>(null);
  if (!q || !q.owner || owners.length < 2) return null; // 无队列/无责任对象的案例跳过
  const correct = q.owner;
  const firstField = String(Object.values(q.fields || {})[0] ?? '');
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><h2><Icon name="gamepad" /> 你来决策</h2><span className="muted">基于本案例真实异常队列 · 答对计入学习成就</span></div>
      <p style={{ fontSize: 13, color: 'var(--ink)' }}>
        队列第 1 条异常：状态「<b style={{ color: 'var(--warn)' }}>{q.state}</b>」{firstField && <>（{firstField}）</>}。
        按数字化闭环的「异常→<b>责任</b>→行动」，这条最该派给谁处置？
      </p>
      <div className="ov-top" role="group" aria-label="选择责任对象">
        {owners.map((o) => (
          <button key={o} className="chip" aria-pressed={picked === o} onClick={() => { if (picked) return; setPicked(o); markQuiz(data.num, o === correct); }}
            style={{ cursor: picked ? 'default' : 'pointer', borderColor: picked ? (o === correct ? 'var(--ok)' : o === picked ? 'var(--bad)' : 'var(--border)') : 'var(--border)', color: picked && o === correct ? 'var(--ok)' : undefined, padding: '6px 12px' }}>
            {o}{picked && o === correct ? ' ✓' : ''}
          </button>
        ))}
      </div>
      {picked && (
        <div className="banner" style={{ marginTop: 12, color: picked === correct ? 'var(--ok)' : 'var(--bad)', borderColor: picked === correct ? 'var(--ok)' : 'var(--bad)' }}>
          {picked === correct ? '✓ 正确！' : `✗ 正解是「${correct}」。`} 这条异常在真实队列里正是由 <b>{correct}</b> 负责——决策动作：{data.decisionAction}
        </div>
      )}
    </section>
  );
}
