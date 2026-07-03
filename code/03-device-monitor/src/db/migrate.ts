import { readdirSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openDb, withTransaction, type Db } from '../shared/db.ts';
import { config } from '../config.ts';

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');

/** 按文件名序应用未执行过的迁移，返回本次应用的文件名列表。 */
export function runMigrations(db: Db): { applied: string[] } {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const done = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map((r) => r.name)
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    withTransaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString()
      );
    });
    applied.push(file);
  }
  return { applied };
}

if (import.meta.main) {
  if (process.argv.includes('--fresh')) {
    rmSync(config.dbPath, { force: true });
    rmSync(`${config.dbPath}-journal`, { force: true });
    rmSync(`${config.dbPath}-wal`, { force: true });
    rmSync(`${config.dbPath}-shm`, { force: true });
  }
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = openDb(config.dbPath);
  const { applied } = runMigrations(db);
  console.log(applied.length ? `已应用迁移：${applied.join(', ')}` : '无待应用迁移');
  db.close();
}
