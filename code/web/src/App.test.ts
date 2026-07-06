import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(import.meta.dirname, 'App.tsx'), 'utf8');
describe('App 路由 / 装配', () => {
  it('案例页装配 SpecialScreen + 真实后端数据 fetchCaseData', () => { expect(src).toContain('SpecialScreen'); expect(src).toContain('fetchCaseData'); });
  it('学习进度接线 markViewed + 主要路由（/case/ /lab/ /game）', () => { expect(src).toContain('markViewed'); for (const r of ['/case/', '/lab/', '/game']) expect(src).toContain(r); });
});
