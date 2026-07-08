import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.ts';
/** 后端 checker：真实 API 冒烟（health/cases/case data/vector search/sqlite query）全绿。 */
test('后端 API 全绿', async () => {
  const app = await buildApp();
  const h = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(h.statusCode, 200); assert.equal(h.json().ok, true);
  assert.ok(h.json().subsystems.length >= 4 && h.json().checker, '后端子系统清单(dogfood)');
  const cs = await app.inject({ url: '/api/cases' });
  assert.ok(Array.isArray(cs.json()) && cs.json().length >= 5, '案例列表非空（精品集，具体数以 defs 为准）');
  const rt = await app.inject({ url: '/api/retail' });
  assert.ok(rt.json().cats.length >= 3 && rt.json().triage.length >= 1, '零售经营');
  const rf = await app.inject({ url: '/api/rfm' });
  assert.ok(rf.json().total > 0 && rf.json().segments.length >= 2, 'RFM 分层');
  assert.ok(rf.json().churnRate >= 0 && rf.json().churnRate <= 100, '高价值流失率∈[0,100]');
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

/** 覆盖补强：每端点补契约级断言——arch 真实依赖图/ADR/契约、index 索引、case data 闭环字段。 */
test('后端 API 覆盖补强（端点契约·dogfood）', async () => {
  const app = await buildApp();
  const ar = await app.inject({ url: '/api/arch' });
  assert.equal(ar.statusCode, 200);
  assert.ok(ar.json().subsystems.length >= 3, 'arch 子系统 >= 3');
  assert.ok(Array.isArray(ar.json().edges), 'arch 依赖边为数组');
  assert.ok(typeof ar.json().cycles === 'number' && ar.json().cycles >= 0, 'arch 循环依赖计数 >= 0');
  assert.ok(ar.json().adr.id && ar.json().adr.why, 'arch 带 ADR 决策 + 重估信号');
  assert.ok(ar.json().contract.envelope && ar.json().contract.openapi, 'arch 带接口契约(错误信封 + OpenAPI)');
  const ix = await app.inject({ url: '/api/index' });
  assert.equal(ix.statusCode, 200);
  const idx = ix.json();
  assert.ok((Array.isArray(idx) ? idx.length : Object.keys(idx).length) >= 1, 'index 案例索引非空');
  const gt = await app.inject({ url: '/api/gates' });
  assert.equal(gt.statusCode, 200);
  assert.ok(typeof gt.json().green === 'boolean' && gt.json().verify.checks > 100, 'gates 活体门禁：真跑 verify 出检查数');
  assert.ok(gt.json().evalGate.judge.includes('hit@3'), 'gates 含 eval 回归门口径');
  const cd = await app.inject({ url: '/api/case/1/data' });
  assert.ok(Array.isArray(cd.json().actions) && cd.json().responsible !== undefined, 'case data 含行动项 + 责任归属(闭环)');
  const oa2 = await app.inject({ url: '/api/openapi.json' });
  assert.ok(oa2.json().paths['/api/cases'] && oa2.json().paths['/api/search'], 'OpenAPI 覆盖核心端点(cases/search)');
  await app.close();
});
