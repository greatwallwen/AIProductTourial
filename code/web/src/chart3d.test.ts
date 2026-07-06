import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(import.meta.dirname, 'chart3d.tsx'), 'utf8');
describe('three.js 三维图表（懒加载 chunk）', () => {
  it('R3F Canvas + 默认导出（screens 懒加载 import(./chart3d) 依赖它）', () => { expect(src).toContain('Canvas'); expect(src).toMatch(/export default/); });
});
