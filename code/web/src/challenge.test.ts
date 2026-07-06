import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(import.meta.dirname, 'challenge.tsx'), 'utf8');
describe('你来决策（案例内挑战）', () => {
  it('接线学习计分 markQuiz（答对计入成就）', () => expect(src).toContain('markQuiz'));
  it('从案例真实异常队列取题（queue / q.state）', () => { expect(src).toContain('queue'); expect(src).toContain('q.state'); });
});
