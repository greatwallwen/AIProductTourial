import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.ts';
/** 后端 checker：真实 API 冒烟（health/cases/case data/vector search/sqlite query）全绿。 */
test('后端 API 全绿', async () => {
  const app = await buildApp();
  const h = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(h.statusCode, 200); assert.equal(h.json().ok, true);
  const cs = await app.inject({ url: '/api/cases' });
  assert.ok(Array.isArray(cs.json()) && cs.json().length >= 20, '案例列表 >= 20');
  const d = await app.inject({ url: '/api/case/1/data' });
  assert.equal(d.statusCode, 200); assert.ok(d.json().kpis.length >= 3); assert.ok(d.json().rowCount > 0, '实时读 CSV 行数 > 0');
  const s = await app.inject({ url: '/api/search?q=product roadmap' });
  assert.ok(s.json().corpus > 0, '向量语料 > 0'); assert.ok(s.json().hits.length > 0, '检索命中 > 0');
  const q = await app.inject({ url: '/api/db/query' });
  assert.ok(q.json().rows.length > 0, 'SQLite 真实查询有结果');
  await app.close();
});
