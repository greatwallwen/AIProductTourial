import { DatabaseSync } from 'node:sqlite';
import { parseCsv } from '../data/csv.ts';
/** node:sqlite 真关系库（PostgreSQL 架构案例：本地 SQLite 演示，生产为 PG）。真建表/索引/参数化查询。 */
export function buildOrdersDb(csvPath: string): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE orders (
    order_no TEXT, dt TEXT, sku TEXT, category TEXT, region TEXT,
    qty INTEGER, price REAL, amount REAL, gross REAL, stock_days INTEGER, reason TEXT, owner TEXT
  )`);
  const t = parseCsv(csvPath);
  const col = (n: string) => t.head.indexOf(n);
  const ins = db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const idx = { on: col('订单号'), dt: col('日期'), sku: col('SKU'), cat: col('品类'), reg: col('区域'), qty: col('数量'), price: col('单价'), amt: col('金额'), gross: col('毛利率'), sd: col('库存天数'), rs: col('异常原因'), ow: col('责任人') };
  for (const r of t.rows) ins.run(r[idx.on], r[idx.dt], r[idx.sku], r[idx.cat], r[idx.reg], Number(r[idx.qty]) | 0, Number(r[idx.price]) || 0, Number(r[idx.amt]) || 0, Number(r[idx.gross]) || 0, Number(r[idx.sd]) | 0, r[idx.rs] || '', r[idx.ow] || '');
  db.exec('CREATE INDEX idx_region ON orders(region)'); // 真实索引（PG 同理）
  return db;
}
/** 参数化查询（防注入）。返回真实行。 */
export function query(db: DatabaseSync, sql: string, params: unknown[] = []): unknown[] {
  return db.prepare(sql).all(...(params as any[]));
}
