import { join } from 'node:path';
import { gates } from '../services/gates.ts';
import { listCases, caseData, getIndex, creditSegment, retail, retailRfm, serverSubsystems, archModel } from '../services/cases.ts';
import { tokenize } from '../services/tokenize.ts';
import { openapiSpec } from '../services/openapi.ts';
import { VectorStore } from '../vector/store.ts';
import { buildOrdersDb, query } from '../db/relational.ts';
/** HTTP 层：只做输入输出，业务委托 services；统一响应结构。 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
let vs: VectorStore | null = null;
let db: any = null;
function getVs() { if (!vs) { vs = new VectorStore(); vs.loadDir(join(ROOT, 'dataset', 'rag', 'corpus')); } return vs; } // v22：中文语料 CMRC2018（store.ts 二元组分词）
function getDb() { if (!db) db = buildOrdersDb(join(ROOT, 'dataset', 'order_data.csv')); return db; }

export async function apiRoutes(app: any) {
  app.get('/api/health', async () => ({ ok: true, service: 'pm-kb-server', subsystems: serverSubsystems(), checker: 'tests' }));
  app.get('/api/arch', async () => archModel());
  app.get('/api/gates', async () => gates()); // v17-B 活体门禁：真跑 verify+eval_harness
  app.get('/api/cases', async () => listCases());
  app.get('/api/index', async () => getIndex());
  app.get('/api/case/:num/data', async (req: any, reply: any) => {
    const d = caseData(Number(req.params.num));
    if (!d) return reply.code(404).send({ error: { code: 'CASE_NOT_FOUND', message: '案例不存在' } });
    return d;
  });
  app.get('/api/credit', async () => creditSegment());
  app.get('/api/retail', async () => retail());
  app.get('/api/rfm', async () => retailRfm());
  app.get('/api/tokenize', async (req: any) => tokenize(String(req.query.text ?? '你好，今天天气怎么样？Hello AI Agent 2026')));
  app.get('/api/openapi.json', async () => openapiSpec());
  app.get('/api/search', async (req: any) => {
    const q = String(req.query.q || '铁路全长多少公里');
    const r = getVs().search(q, 3, 10); // 召回 top-10 → 重排 top-3
    return { ...r, hits: r.reranked.map((x: any) => ({ id: x.id, score: x.rerank, snippet: x.snippet })) };
  });
  app.get('/api/db/query', async (req: any) => {
    const region = req.query.region ? String(req.query.region) : null;
    const GROUPS: Record<string, string> = { region: 'region', category: 'category' }; // v17 P0-9：换维聚合白名单（案45「换品类聚合」动手项成真）
    const g = GROUPS[String(req.query.group || 'region')] || 'region';
    const d = getDb();
    const sql = region
      ? 'SELECT sku,category,region,amount,gross FROM orders WHERE region=? ORDER BY amount DESC LIMIT 8'
      : `SELECT ${g} AS dim, COUNT(*) n, ROUND(SUM(amount)) amt FROM orders GROUP BY ${g} ORDER BY amt DESC`;
    const rows = region ? query(d, sql, [region]) : query(d, sql, []);
    // v18-P1：真实执行计划上屏——EXPLAIN QUERY PLAN 是 sqlite 真实输出，不是文案
    const plan = query(d, 'EXPLAIN QUERY PLAN ' + sql, region ? [region] : []);
    return { engine: 'node:sqlite（本地演示，生产为 PostgreSQL / pgvector）', sql, rows, plan };
  });
}
