import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTestApp, registerTenant, registerAndGetKey, createTicket, type TestApp } from './helpers.ts';

describe('租户注册开通与鉴权', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  it('注册返回明文 Key 仅此一次，库中只存 sha256 哈希', async () => {
    const res = await registerTenant(app);
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.match(body.apiKey, /^wd_mingrui_[0-9a-f]{24}$/);
    assert.equal(body.plan, 'pro');

    const row = app.db.prepare('SELECT * FROM tenants WHERE tenant_code = ?').get('MINGRUI') as Record<
      string,
      unknown
    >;
    assert.equal(row.api_key_hash, createHash('sha256').update(body.apiKey).digest('hex'));
    for (const [col, val] of Object.entries(row)) {
      assert.notEqual(val, body.apiKey, `明文 Key 不得落库（发现于列 ${col}）`);
    }
  });

  it('开通是单事务：admin 用户与发号器同时就位，注册后首单即 -0001', async () => {
    const apiKey = await registerAndGetKey(app);

    const admin = app.db
      .prepare('SELECT name, email, role FROM users WHERE email = ?')
      .get('shenyi@mingrui.example.com') as { name: string; role: string };
    assert.equal(admin.role, 'admin');
    assert.equal(admin.name, '沈毅');
    const seq = app.db.prepare('SELECT seq FROM ticket_seq').get() as { seq: number };
    assert.equal(seq.seq, 0, '发号器应随注册事务初始化为 0');

    const res = await createTicket(app, apiKey);
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().ticketNo, 'MINGRUI-0001');
  });

  it('无 Key / 错 Key 访问工单域一律 401 UNAUTHORIZED', async () => {
    await registerTenant(app);

    const noKey = await app.inject({ method: 'GET', url: '/api/tickets' });
    assert.equal(noKey.statusCode, 401);
    assert.equal(noKey.json().error.code, 'UNAUTHORIZED');

    const badKey = await app.inject({
      method: 'GET',
      url: '/api/tickets',
      headers: { 'x-api-key': `wd_mingrui_${'0'.repeat(24)}` },
    });
    assert.equal(badKey.statusCode, 401);
    assert.equal(badKey.json().error.code, 'UNAUTHORIZED');
  });
});
