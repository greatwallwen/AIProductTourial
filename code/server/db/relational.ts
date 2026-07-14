import { DatabaseSync } from 'node:sqlite';
import { parseCsv } from '../data/csv.ts';
/** node:sqlite 真关系库（PostgreSQL 架构案例：本地 SQLite 演示，生产为 PG）。真建表/索引/参数化查询。
 *  orders（零售，供旧演示）+ air_quality（案例05·北京空气质量真表 14 万行，讲「大表查询优化/复合索引/EXPLAIN」）。 */
export function buildOrdersDb(csvPath: string, airCsvPath?: string): DatabaseSync {
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
  // 案例05：北京空气质量真表（14 万行·12 站）——故意「无索引」建表，让 EXPLAIN 演示 SCAN→SEARCH。ts=可排序时间键，供 (station,ts) 复合索引。
  if (airCsvPath) {
    db.exec('CREATE TABLE air_quality (station TEXT, ts INTEGER, year INT, month INT, day INT, hour INT, pm25 REAL, pm10 REAL, so2 REAL, no2 REAL, co REAL, o3 REAL, temp REAL)');
    const a = parseCsv(airCsvPath);
    const ac = (n: string) => a.head.indexOf(n);
    const ci = { st: ac('站点'), y: ac('年'), mo: ac('月'), d: ac('日'), h: ac('时'), pm25: ac('PM2.5'), pm10: ac('PM10'), so2: ac('SO2'), no2: ac('NO2'), co: ac('CO'), o3: ac('O3'), tp: ac('气温') };
    const num = (x: string) => { const n = Number(x); return Number.isFinite(n) ? n : null; }; // NA 缺口→NULL（真实数据有洞）
    const ains = db.prepare('INSERT INTO air_quality VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    db.exec('BEGIN');
    for (const r of a.rows) { const y = +r[ci.y] | 0, mo = +r[ci.mo] | 0, dd = +r[ci.d] | 0, hh = +r[ci.h] | 0;
      const st = (r[ci.st] || '').replace(/[\r\n]/g, '').trim(); // 防 CRLF 残留污染站名
      ains.run(st, y * 1000000 + mo * 10000 + dd * 100 + hh, y, mo, dd, hh, num(r[ci.pm25]), num(r[ci.pm10]), num(r[ci.so2]), num(r[ci.no2]), num(r[ci.co]), num(r[ci.o3]), num(r[ci.tp])); }
    db.exec('COMMIT');
  }
  return db;
}
/** 参数化查询（防注入）。返回真实行。 */
export function query(db: DatabaseSync, sql: string, params: unknown[] = []): unknown[] {
  return db.prepare(sql).all(...(params as any[]));
}
