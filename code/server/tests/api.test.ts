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
  assert.ok(s.json().recall.length >= s.json().reranked.length, '两阶段：召回 >= 重排');
  assert.equal(s.json().recallN, 10, '粗召回 top-10');
  const q = await app.inject({ url: '/api/db/query' });
  assert.ok(q.json().rows.length > 0, 'SQLite 真实查询有结果');
  const tk = await app.inject({ url: '/api/tokenize?text=今天天气怎么样？Hello AI' });
  assert.ok(tk.json().count > 0 && tk.json().tokens.length > 0, '分词有 Token');
  assert.ok(tk.json().ratio > 0, '量化换算比有值');
  const oa = await app.inject({ url: '/api/openapi.json' });
  assert.ok(oa.json().paths['/api/tokenize'] && oa.json().openapi.startsWith('3.'), 'OpenAPI 覆盖 tokenize');
  await app.close();
});
