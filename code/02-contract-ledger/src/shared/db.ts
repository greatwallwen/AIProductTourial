import { DatabaseSync } from 'node:sqlite';

// 版本守卫：Node < 24 无稳定 node:sqlite、无 .ts 直跑，且 import.meta.main 为 undefined
// 会让 db:migrate 静默不执行。此处显式报错，胜过后续晦涩的 "Unknown file extension .ts"。
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 24) {
  throw new Error(
    `本工程需要 Node.js ≥ 24（当前 ${process.versions.node}）。请升级 Node，或用 nvm 切换到 24。`
  );
}

export type Db = DatabaseSync;

/** 打开数据库。node:sqlite 为同步 API：教程数据量下事件循环阻塞无感，权衡见案例正文。 */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  return db;
}

/** node:sqlite 没有事务助手，40 行封装抹平；换 better-sqlite3/PG 时只改本文件。 */
export function withTransaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
