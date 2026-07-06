import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(import.meta.dirname, 'pages.tsx'), 'utf8');
describe('首页 / 页面', () => {
  it('数字化系统全景 + 学习进度徽章（用 Icon 专业图标）', () => { expect(src).toContain('全景'); expect(src).toContain('badges'); expect(src).toContain('Icon'); });
});
