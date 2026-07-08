/** P0 TDD：scatter()/matrix() 两个数据驱动 mark（只加真正用到的，不做通用图库）。node --test 运行。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scatter, matrix } from './diagram.mjs';

const t = { bg: '#0a0f16', bg2: '#0d1420', panel: '#111a28', panelSoft: '#0f1725', border: '#223', grid: '#1a2536', ink: '#e8eef7', ink2: '#b9c6d8', muted: '#7e8ba0', accent: '#22d3ee', accent2: '#a78bfa', ok: '#34d399', warn: '#fbbf24', bad: '#f87171' };

test('scatter：按序列渲染数据点+坐标轴+图例，确定性输出', () => {
  const spec = { W: 600, H: 400, title: 'R×F 散点', xLabel: 'R(天)', yLabel: 'F(次)', series: [
    { label: '真实', color: t.ok, points: [{ x: 10, y: 30 }, { x: 200, y: 5 }, { x: 90, y: 12 }] },
    { label: '合成', color: t.warn, points: [{ x: 40, y: 20 }, { x: 300, y: 2 }] },
  ] };
  const svg = scatter(spec, t);
  assert.ok(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), '完整 svg');
  assert.equal((svg.match(/<circle /g) || []).length, 5, '数据点数 = 各序列 points 之和');
  assert.ok(svg.includes('R(天)') && svg.includes('F(次)'), '含轴标签');
  assert.ok(svg.includes('真实') && svg.includes('合成'), '含序列图例');
  assert.equal(svg, scatter(spec, t), '同输入同输出（截图稳定）');
});

test('matrix：行×列热力格 + 数值 + 转义', () => {
  const spec = { W: 500, H: 320, title: '矩阵', rows: ['低', '中<高'], cols: ['A', 'B', 'C'], cells: [[1, 5, 3], [0, 2, 9]] };
  const svg = matrix(spec, t);
  assert.ok((svg.match(/class="cell"/g) || []).length === 6, '格子数 = rows×cols');
  assert.ok(svg.includes('>9<') && svg.includes('>0<'), '格内含数值');
  assert.ok(svg.includes('中&lt;高'), '标签转义');
});
