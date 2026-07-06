import { describe, it, expect, beforeEach } from 'vitest';
// mock localStorage（node 环境）
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
import { markViewed, markQuiz, getProgress } from './progress';

describe('学习进度', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });
  it('看过与答对计数、百分比、成就', () => {
    markViewed(1); markViewed(2); markQuiz(1, true); markQuiz(2, false);
    const p = getProgress(4);
    expect(p.viewed).toBe(2);
    expect(p.correct).toBe(1);
    expect(p.pct).toBe(50);
    expect(p.badges.map((b) => b.label)).toContain('起步');
    expect(p.badges.map((b) => b.label)).toContain('过半');
  });
  it('空进度不报错', () => { const p = getProgress(25); expect(p.viewed).toBe(0); expect(p.pct).toBe(0); });
});
