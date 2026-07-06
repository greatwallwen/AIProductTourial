import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// 对抗式测试基础（无需 DOM）：案例屏 dispatch 完整性——每个 case.screen 值都必须在 SpecialScreen 里有分支，否则该案例渲染成 null。
const screens = readFileSync(join(import.meta.dirname, 'screens.tsx'), 'utf8');
const defs = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'tools', 'case_definitions.json'), 'utf8'));

describe('案例屏 dispatch 完整性', () => {
  it('每个 case.screen 都有 SpecialScreen 分支（防 null 渲染）', () => {
    const used = [...new Set(defs.cases.map((c: any) => c.screen).filter(Boolean))];
    const missing = used.filter((s) => !new RegExp(`screen === '${s}'`).test(screens));
    expect(missing).toEqual([]);
  });
  it('SpecialScreen 对未知 screen 兜底 return null（不崩）', () => {
    expect(/return null;?\s*}/.test(screens)).toBe(true);
  });
});
