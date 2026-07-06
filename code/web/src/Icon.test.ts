import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// 对抗式测试基础（无需 DOM）：图标名完整性——每个 <Icon name="字面量"> 都必须在 Icon.tsx 的映射里，否则渲染成 null（静默失败）。
const SRC = import.meta.dirname;
const iconSrc = readFileSync(join(SRC, 'Icon.tsx'), 'utf8');
const known = new Set([...iconSrc.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*`/gm)].map((m) => m[1]));

describe('Icon 名称完整性', () => {
  it('图标映射非空且覆盖常用图标', () => {
    expect(known.size).toBeGreaterThan(8);
    for (const n of ['search', 'sun', 'moon', 'alert', 'rocket']) expect(known.has(n)).toBe(true);
  });
  it('所有 <Icon name="字面量"> 都在映射里（防 null 静默渲染）', () => {
    const missing: string[] = [];
    for (const f of readdirSync(SRC).filter((x) => /\.tsx$/.test(x))) {
      const s = readFileSync(join(SRC, f), 'utf8');
      for (const m of s.matchAll(/name=["']([a-z0-9-]+)["']/g)) if (!known.has(m[1])) missing.push(`${f}:${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
});
