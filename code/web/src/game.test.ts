import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(import.meta.dirname, 'game.tsx'), 'utf8');
describe('概念/镜头配对游戏', () => {
  it('两种模式都在（概念配对 + 哪个镜头）', () => { expect(src).toContain('CONCEPT_PAIRS'); expect(src).toContain('LENS_PAIRS'); expect(src).toContain('哪个镜头'); });
  it('每个 pair 有 c 与 d，且概念不重复（重复会破坏配对匹配）', () => {
    const cs = [...src.matchAll(/\{ c: '([^']+)', d: '/g)].map((m) => m[1]);
    expect(cs.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cs).size).toBe(cs.length);
  });
});
