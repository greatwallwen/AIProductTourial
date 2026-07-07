// 手写精简 OpenAPI 3.1 spec（呼应 §3 接口契约）：覆盖全部 /api/* 接口。
export function openapiSpec() {
  const ok = { description: '成功', content: { 'application/json': {} } };
  const g = (summary: string, params: any[] = []) => ({ get: { summary, parameters: params, responses: { '200': ok } } });
  const q = (name: string, desc: string) => ({ name, in: 'query', required: false, schema: { type: 'string' }, description: desc });
  return {
    openapi: '3.1.0',
    info: { title: '数字化产品知识库 · 后端 API', version: '5.0.0', description: '一服务托管全部案例的真实 API（Fastify + node:sqlite）。' },
    paths: {
      '/api/health': g('健康检查（接口契约演示）'),
      '/api/index': g('案例索引（含 systemLayer/systemStage）'),
      '/api/cases': g('案例列表'),
      '/api/case/{num}/data': { get: { summary: '案例视图模型（实时读 CSV 复算）', parameters: [{ name: 'num', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': ok, '404': { description: '案例不存在' } } } },
      '/api/search': g('向量库语义检索（RAG，纯 JS 真向量库）', [q('q', '查询词')]),
      '/api/db/query': g('关系库聚合查询（node:sqlite，PG 架构）', [q('region', '区域过滤')]),
      '/api/tokenize': g('实时分词（Tokenizer 概念演示）', [q('text', '待分词文本')]),
      '/api/openapi.json': g('本 OpenAPI 规范'),
    },
  };
}
