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
function getVs() { if (!vs) { vs = new VectorStore(); vs.loadDir(join(ROOT, 'dataset', 'rag', 'corpus')); } return vs; } // v24：中文医疗语料 webMedQA（store.ts 二元组分词）
function getDb() { if (!db) db = buildOrdersDb(join(ROOT, 'dataset', 'order_data.csv'), join(ROOT, 'dataset', 'real', 'beijing_air_quality.csv')); return db; }

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
    const q = String(req.query.q || '如何斜视矫正');
    const r = getVs().search(q, 3, 10); // 召回 top-10 → 重排 top-3
    return { ...r, hits: r.reranked.map((x: any) => ({ id: x.id, score: x.rerank, snippet: x.snippet })) };
  });
  app.get('/api/db/query', async (req: any) => {
    // v24：案例05 改查北京空气质量真表（14 万行/12 站）——「大表查询优化/复合索引/EXPLAIN」在真大表上才有说服力。
    const GROUPS: Record<string, string> = { station: 'station', month: 'month' }; // 换维聚合白名单
    const g = GROUPS[String(req.query.group || 'station')] || 'station';
    const d = getDb();
    const total = (query(d, 'SELECT COUNT(*) c FROM air_quality', []) as any[])[0].c;
    const sql = `SELECT ${g} AS dim, COUNT(*) n, ROUND(AVG(pm25),1) amt FROM air_quality WHERE pm25 IS NOT NULL GROUP BY ${g} ORDER BY amt DESC`;
    const rows = query(d, sql, []);
    const plan = query(d, 'EXPLAIN QUERY PLAN ' + sql, []);
    // 加索引前/后：同一条 WHERE station=? ORDER BY ts。air_quality 无常驻索引 → 14 万行 SCAN；建 (station,ts) 复合索引后 SEARCH USING INDEX。用完即删。
    const demoSql = 'SELECT station,ts,pm25 FROM air_quality WHERE station=? ORDER BY ts DESC LIMIT 8';
    const anySt = (query(d, "SELECT station FROM air_quality LIMIT 1", []) as any[])[0]?.station || '';
    const idxBefore = query(d, 'EXPLAIN QUERY PLAN ' + demoSql, [anySt]);
    try { d.exec('CREATE INDEX ix_air_demo ON air_quality(station, ts)'); } catch { /* 已存在则忽略 */ }
    const idxAfter = query(d, 'EXPLAIN QUERY PLAN ' + demoSql, [anySt]);
    try { d.exec('DROP INDEX ix_air_demo'); } catch { /* 幂等清理 */ }
    const indexDemo = { sql: demoSql, key: anySt, before: idxBefore, after: idxAfter };
    return { engine: 'node:sqlite（本地演示，生产为 PostgreSQL）', table: 'air_quality', rowCount: total, sql, rows, plan, indexDemo };
  });
}
