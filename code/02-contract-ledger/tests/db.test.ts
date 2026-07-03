import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, withTransaction } from '../src/shared/db.ts';
import { runMigrations } from '../src/db/migrate.ts';

describe('shared/db', () => {
  it('openDb 打开内存库并可执行 SQL', () => {
    const db = openDb(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO t (name) VALUES (?)').run('合同');
    const row = db.prepare('SELECT name FROM t WHERE id = 1').get() as { name: string };
    assert.equal(row.name, '合同');
    db.close();
  });

  it('withTransaction 成功时提交', () => {
    const db = openDb(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    withTransaction(db, () => {
      db.prepare('INSERT INTO t (id) VALUES (1)').run();
      db.prepare('INSERT INTO t (id) VALUES (2)').run();
    });
    const n = db.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number };
    assert.equal(n.n, 2);
    db.close();
  });

  it('withTransaction 抛错时整体回滚', () => {
    const db = openDb(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    assert.throws(() =>
      withTransaction(db, () => {
        db.prepare('INSERT INTO t (id) VALUES (1)').run();
        throw new Error('业务失败');
      })
    );
    const n = db.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number };
    assert.equal(n.n, 0);
    db.close();
  });
});

describe('db/migrate', () => {
  it('按序应用迁移并记录版本，重复执行为幂等', () => {
    const db = openDb(':memory:');
    const first = runMigrations(db);
    assert.ok(first.applied.length >= 1, '首次执行应至少应用 1 个迁移');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    for (const required of ['contracts', 'approval_tasks', 'contract_seq']) {
      assert.ok(names.includes(required), `缺少表 ${required}`);
    }
    const second = runMigrations(db);
    assert.equal(second.applied.length, 0, '第二次执行不应重复应用');
    db.close();
  });
});
