import { join } from 'node:path';
import { listCases, caseData, getIndex, points3d, rfm, hospital, adFunnel } from '../services/cases.ts';
import { tokenize } from '../services/tokenize.ts';
import { openapiSpec } from '../services/openapi.ts';
import { VectorStore } from '../vector/store.ts';
import { buildOrdersDb, query } from '../db/relational.ts';
/** HTTP 层：只做输入输出，业务委托 services；统一响应结构。 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
let vs: VectorStore | null = null;
let db: any = null;
function getVs() { if (!vs) { vs = new VectorStore(); vs.loadDir(join(ROOT, 'skills', 'external', 'pm-skills-deanpeters')); } return vs; }
function getDb() { if (!db) db = buildOrdersDb(join(ROOT, 'dataset', 'order_data.csv')); return db; }

export async function apiRoutes(app: any) {
  app.get('/api/health', async () => ({ ok: true, service: 'pm-kb-server' }));
  app.get('/api/cases', async () => listCases());
  app.get('/api/index', async () => getIndex());
  app.get('/api/case/:num/data', async (req: any, reply: any) => {
    const d = caseData(Number(req.params.num));
    if (!d) return reply.code(404).send({ error: { code: 'CASE_NOT_FOUND', message: '案例不存在' } });
    return d;
  });
  app.get('/api/points3d', async () => points3d());
  app.get('/api/rfm', async () => rfm());
  app.get('/api/hospital', async () => hospital());
  app.get('/api/adfunnel', async () => adFunnel());
  app.get('/api/tokenize', async (req: any) => tokenize(String(req.query.text ?? '你好，今天天气怎么样？Hello AI Agent 2026')));
  app.get('/api/openapi.json', async () => openapiSpec());
  app.get('/api/search', async (req: any) => {
    const q = String(req.query.q || 'product roadmap');
    const r = getVs().search(q, 3, 10); // 召回 top-10 → 重排 top-3
    return { ...r, hits: r.reranked.map((x: any) => ({ id: x.id, score: x.rerank, snippet: x.snippet })) };
  });
  app.get('/api/db/query', async (req: any) => {
    const region = req.query.region ? String(req.query.region) : null;
    const d = getDb();
    const rows = region
      ? query(d, 'SELECT sku,category,region,amount,gross FROM orders WHERE region=? ORDER BY amount DESC LIMIT 8', [region])
      : query(d, 'SELECT region, COUNT(*) n, ROUND(SUM(amount)) amt FROM orders GROUP BY region ORDER BY amt DESC', []);
    return { engine: 'node:sqlite（本地演示，生产为 PostgreSQL / pgvector）', rows };
  });
}
