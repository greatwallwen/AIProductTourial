import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/shared/db.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { createNotifyService } from '../src/modules/notify/index.ts';
import { BACKOFF_MS } from '../src/modules/notify/types.ts';
import { createTestApp, validSubmission, act } from './helpers.ts';

describe('notify 出站表与定时投递', () => {
  it('办结即入队一条短信（与状态流转同一事务）', async () => {
    const app = await createTestApp();
    const { applyNo } = (await app.inject({ method: 'POST', url: '/api/applications', payload: validSubmission })).json();
    for (const a of ['accept', 'start_review', 'approve', 'conclude']) await act(app, applyNo, a, '窗口-李芳');
    const outbound = app.notify.listByApplication(
      (app.db.prepare('SELECT id FROM applications WHERE apply_no = ?').get(applyNo) as { id: number }).id
    );
    assert.equal(outbound.length, 1);
    assert.equal(outbound[0]!.channel, 'sms');
    assert.equal(outbound[0]!.status, 'pending');
    assert.match(outbound[0]!.payload, /已办结/);
    await app.close();
  });

  describe('投递与退避', () => {
    let db: ReturnType<typeof openDb>;
    beforeEach(() => {
      db = openDb(':memory:');
      runMigrations(db);
      // 造一条最小 application 供外键引用
      db.prepare(
        `INSERT INTO catalog_items (item_code, item_name, implement_org, item_type, legal_days, promise_days, required_materials)
         VALUES ('X', '事项', '机关', '许可', 20, 10, '[]')`
      ).run();
      db.prepare(
        `INSERT INTO applications (apply_no, item_id, applicant_name, applicant_id_no, applicant_phone, status, submitted_at)
         VALUES ('NO-1', 1, '张三', '***', '138****', 'concluded', '2026-01-01T00:00:00.000Z')`
      ).run();
    });
    afterEach(() => db.close());

    it('sender 成功：pending → sent', async () => {
      const svc = createNotifyService({ db, sender: () => {} });
      svc.enqueue({ applicationId: 1, channel: 'sms', recipient: '138****', payload: 'hi' });
      const r = await svc.dispatchDue();
      assert.deepEqual(r, { sent: 1, retried: 0, dead: 0 });
      assert.equal(svc.listByApplication(1)[0]!.status, 'sent');
    });

    it('sender 失败：退避重试，用尽退避序列后转 dead', async () => {
      const svc = createNotifyService({
        db,
        sender: () => {
          throw new Error('网关超时');
        },
      });
      svc.enqueue({ applicationId: 1, channel: 'sms', recipient: '138****', payload: 'hi' });
      // 基准时间取入队消息的 next_retry_at（= 入队时刻），此后按退避序列推进，保证每次都到期
      let t = Date.parse(svc.listByApplication(1)[0]!.nextRetryAt);
      for (let i = 0; i < BACKOFF_MS.length; i++) {
        const r = await svc.dispatchDue(t);
        assert.equal(r.retried, 1, `第 ${i + 1} 次应重试`);
        t += BACKOFF_MS[i]!; // 推进到下一次到期
      }
      const final = await svc.dispatchDue(t);
      assert.deepEqual(final, { sent: 0, retried: 0, dead: 1 });
      const msg = svc.listByApplication(1)[0]!;
      assert.equal(msg.status, 'dead');
      assert.equal(msg.retryCount, BACKOFF_MS.length + 1);
      assert.match(msg.lastError ?? '', /网关超时/);
    });

    it('未到期不投递：next_retry_at 在未来的消息被跳过', async () => {
      const svc = createNotifyService({ db, sender: () => { throw new Error('x'); } });
      svc.enqueue({ applicationId: 1, channel: 'sms', recipient: '138****', payload: 'hi' });
      const t0 = Date.parse(svc.listByApplication(1)[0]!.nextRetryAt);
      const first = await svc.dispatchDue(t0); // 到期 → 失败 → next_retry_at 推到 +60s
      assert.equal(first.retried, 1);
      const early = await svc.dispatchDue(t0 + 1000); // 仅过 1s，未到下次重试时刻
      assert.deepEqual(early, { sent: 0, retried: 0, dead: 0 });
    });
  });
});
