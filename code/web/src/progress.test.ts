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
  // v21 重编号迁移：旧 key 的 30/49 等旧号按固定映射搬进 v2 key，计数前后一致
  it('旧进度按固定映射迁移到 v2（计数一致）', () => {
    store['pmkb-progress'] = JSON.stringify({ viewed: { '1': 1, '30': 1, '49': 1 }, quiz: { '41': true, '54': false } });
    const p = getProgress(9);
    expect(p.viewed).toBe(3);
    expect(p.correct).toBe(1);
    const v2 = JSON.parse(store['pmkb-progress-v2']);
    expect(Object.keys(v2.viewed).sort()).toEqual(['1', '2', '7']);
    expect(v2.quiz).toEqual({ '3': true, '9': false });
  });
  it('映射外的幽灵旧号被丢弃（防看过数>在册数）', () => {
    store['pmkb-progress'] = JSON.stringify({ viewed: { '48': 1, '50': 1, '30': 1 } });
    expect(getProgress(9).viewed).toBe(1);
  });
  it('v2 已存在时不再迁移（迁移只发生一次）', () => {
    store['pmkb-progress-v2'] = JSON.stringify({ viewed: { '5': 1 } });
    store['pmkb-progress'] = JSON.stringify({ viewed: { '30': 1, '41': 1 } });
    expect(getProgress(9).viewed).toBe(1);
  });
});
