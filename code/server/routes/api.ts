import { join } from 'node:path';
import { listCases, caseData } from '../services/cases.ts';
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
  app.get('/api/case/:num/data', async (req: any, reply: any) => {
    const d = caseData(Number(req.params.num));
    if (!d) return reply.code(404).send({ error: { code: 'CASE_NOT_FOUND', message: '案例不存在' } });
    return d;
  });
  app.get('/api/search', async (req: any) => {
    const q = String(req.query.q || 'product roadmap');
    const v = getVs();
    return { query: q, corpus: v.size, hits: v.search(q, 5) };
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
