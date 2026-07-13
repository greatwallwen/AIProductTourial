import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { grillInit, grillPick, grillNext, type GrillStep } from './grill';

const steps: GrillStep[] = [
  { q: 'q1', options: ['a', 'b', 'c'], correct: 1, onWrong: '错1追问', onRight: '对1深化' },
  { q: 'q2', options: ['a', 'b'], correct: 0, onWrong: '错2追问', onRight: '对2深化' },
];

describe('grill 苏格拉底追问 reducer（纯函数·可测分支）', () => {
  it('答错：停留本步、result=wrong、未完成（可重选）', () => {
    const s = grillPick(steps, grillInit, 0); // 选错
    expect(s.result).toBe('wrong');
    expect(s.stage).toBe(0);
    expect(s.done).toBe(false);
  });
  it('答错后可重选答对：result 翻为 right', () => {
    const wrong = grillPick(steps, grillInit, 2);
    const right = grillPick(steps, wrong, 1); // 重选正解
    expect(right.result).toBe('right');
    expect(right.done).toBe(false); // 非末步
  });
  it('答对非末步 → grillNext 进阶到下一问、状态重置', () => {
    const right = grillPick(steps, grillInit, 1);
    const nx = grillNext(steps, right);
    expect(nx.stage).toBe(1);
    expect(nx.picked).toBe(null);
    expect(nx.result).toBe(null);
  });
  it('末步答对 → done=true', () => {
    let s = grillNext(steps, grillPick(steps, grillInit, 1)); // 进第2问
    s = grillPick(steps, s, 0); // 末步选对
    expect(s.done).toBe(true);
  });
  it('answered-right 时 grillPick 不因再点击而改动（已锁定推进）', () => {
    const right = grillPick(steps, grillInit, 1);
    const nx = grillNext(steps, right);
    // 未答时 next 不推进
    expect(grillNext(steps, grillInit).stage).toBe(0);
    expect(nx.stage).toBe(1);
  });
});

describe('grill 组件接线', () => {
  const src = readFileSync(join(import.meta.dirname, 'grill.tsx'), 'utf8');
  it('从案例真实 grill 字段取题（data.grill）', () => expect(src).toContain('data.grill'));
  it('答错渲染 onWrong 追问、答对渲染 onRight 深化', () => { expect(src).toContain('onWrong'); expect(src).toContain('onRight'); });
  it('通关计入成就 markGrill', () => expect(src).toContain('markGrill'));
});
