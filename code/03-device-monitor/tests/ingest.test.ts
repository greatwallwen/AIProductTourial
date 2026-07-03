import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, ingest, hourStart, at, type TestApp } from './helpers.ts';

describe('遥测写入与小时聚合', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  it('批量写入：响应统计与 raw 行数一致', async () => {
    const base = hourStart(-2);
    const res = await ingest(app, [
      { metric: 'volume_flow', ts: at(base, 0), value: 7.2 },
      { metric: 'volume_flow', ts: at(base, 5), value: 7.3 },
      { metric: 'volume_flow', ts: at(base, 10), value: 7.4 },
      { metric: 'volume_flow', ts: at(base, 15), value: 7.1 },
      { metric: 'volume_flow', ts: at(base, 20), value: 7.6 },
    ]);
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.received, 5);
    assert.equal(body.inserted, 5);
    assert.equal(body.duplicates, 0);
    const n = app.db.prepare('SELECT COUNT(*) AS n FROM telemetry_raw').get() as { n: number };
    assert.equal(n.n, 5);
  });

  it('同一小时两批写入：hourly cnt/sum/min/max 增量正确', async () => {
    const base = hourStart(-1);
    await ingest(app, [
      { metric: 'volume_flow', ts: at(base, 5), value: 7.2 },
      { metric: 'volume_flow', ts: at(base, 10), value: 7.4 },
    ]);
    await ingest(app, [
      { metric: 'volume_flow', ts: at(base, 15), value: 7.0 },
      { metric: 'volume_flow', ts: at(base, 20), value: 7.8 },
    ]);
    const rows = app.db
      .prepare("SELECT hour_ts, cnt, sum, min, max FROM telemetry_hourly WHERE metric = 'volume_flow'")
      .all() as Array<{ hour_ts: string; cnt: number; sum: number; min: number; max: number }>;
    assert.equal(rows.length, 1, '同一小时只应有一个聚合桶');
    assert.equal(rows[0]!.hour_ts, base.toISOString());
    assert.equal(rows[0]!.cnt, 4);
    assert.ok(Math.abs(rows[0]!.sum - 29.4) < 1e-9);
    assert.equal(rows[0]!.min, 7.0);
    assert.equal(rows[0]!.max, 7.8);
  });

  it('重复 ts 幂等：raw 不增、hourly 不重复累计', async () => {
    const base = hourStart(-1);
    const batch = [
      { metric: 'volume_flow', ts: at(base, 5), value: 7.2 },
      { metric: 'volume_flow', ts: at(base, 10), value: 7.4 },
      { metric: 'volume_flow', ts: at(base, 15), value: 7.6 },
    ];
    await ingest(app, batch);
    const res = await ingest(app, batch); // 原样重发
    const body = res.json();
    assert.equal(body.inserted, 0);
    assert.equal(body.duplicates, 3);
    const raw = app.db.prepare('SELECT COUNT(*) AS n FROM telemetry_raw').get() as { n: number };
    assert.equal(raw.n, 3, 'raw 不应重复插入');
    const hourly = app.db.prepare('SELECT cnt, sum FROM telemetry_hourly').get() as { cnt: number; sum: number };
    assert.equal(hourly.cnt, 3, 'hourly 不应重复累计');
    assert.ok(Math.abs(hourly.sum - 22.2) < 1e-9);
  });

  it('未注册设备：404 且整批回滚', async () => {
    const base = hourStart(-1);
    const res = await ingest(app, [
      { metric: 'volume_flow', ts: at(base, 0), value: 7.2 },
      { deviceCode: 'NO-SUCH', metric: 'volume_flow', ts: at(base, 5), value: 7.3 },
    ]);
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'DEVICE_NOT_FOUND');
    const n = app.db.prepare('SELECT COUNT(*) AS n FROM telemetry_raw').get() as { n: number };
    assert.equal(n.n, 0, '整批应回滚，合法点也不落库');
  });
});

describe('有状态告警', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  async function firingList() {
    return (await app.inject({ method: 'GET', url: '/api/alerts?status=firing' })).json();
  }

  it('首条越限产生 firing 告警', async () => {
    const base = hourStart(-1);
    const res = await ingest(app, [{ ts: at(base, 0), value: 115 }]);
    const body = res.json();
    assert.equal(body.alertsFired.length, 1);
    assert.equal(body.alertsFired[0].level, 'critical');
    assert.equal(body.alertsFired[0].title, '主回路压力超限');
    const firing = await firingList();
    assert.equal(firing.length, 1);
    assert.equal(firing[0].deviceCode, 'HYD-PMP-01');
    assert.equal(firing[0].peakValue, 115);
  });

  it('持续越限只更新 last_ts 与 peak_value，不新增；部分唯一索引兜底', async () => {
    const base = hourStart(-1);
    await ingest(app, [{ ts: at(base, 0), value: 112 }]);
    await ingest(app, [
      { ts: at(base, 5), value: 118 },
      { ts: at(base, 10), value: 114 },
    ]);
    const firing = await firingList();
    assert.equal(firing.length, 1, '持续越限不得新增告警');
    assert.equal(firing[0].peakValue, 118, 'peak 应取更劣值');
    assert.equal(firing[0].firstTs, at(base, 0));
    assert.equal(firing[0].lastTs, at(base, 10));
    // 绕过应用层直接插第二条 firing：数据库层部分唯一索引拒绝
    assert.throws(() =>
      app.db
        .prepare(
          `INSERT INTO alerts (rule_id, device_id, status, first_ts, last_ts, peak_value)
           VALUES (1, 1, 'firing', ?, ?, 120)`
        )
        .run(at(base, 15), at(base, 15))
    );
  });

  it('值回落到阈值内自动 resolved', async () => {
    const base = hourStart(-1);
    await ingest(app, [{ ts: at(base, 0), value: 115 }]);
    const res = await ingest(app, [{ ts: at(base, 5), value: 95 }]);
    assert.equal(res.json().alertsResolved.length, 1);
    assert.equal((await firingList()).length, 0);
    const resolved = (await app.inject({ method: 'GET', url: '/api/alerts?status=resolved' })).json();
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].lastTs, at(base, 5), 'resolved 时应推进 last_ts');
  });

  it('乱序补传：迟到的旧正常读数不得消掉更新的越限告警', async () => {
    const base = hourStart(-1);
    // 设备在 base+10 越限并持续，firing 的 last_ts 推进到 base+10
    await ingest(app, [{ ts: at(base, 10), value: 116 }]);
    // 网关补传一条更早的正常读数（base+5，早于 last_ts）——此时设备实际仍在告警
    const res = await ingest(app, [{ ts: at(base, 5), value: 90 }]);
    assert.equal(res.json().alertsResolved.length, 0, '迟到的旧读数不应触发 resolved');
    assert.equal((await firingList()).length, 1, '告警必须保持 firing');
  });

  it('ack 流转：firing→acked，重复 ack 409，acked 后回落同样 resolved', async () => {
    const base = hourStart(-1);
    const fired = (await ingest(app, [{ ts: at(base, 0), value: 115 }])).json();
    const alertId = fired.alertsFired[0].alertId;

    const ack = await app.inject({ method: 'POST', url: `/api/alerts/${alertId}/ack` });
    assert.equal(ack.statusCode, 200);
    assert.equal(ack.json().status, 'acked');

    const again = await app.inject({ method: 'POST', url: `/api/alerts/${alertId}/ack` });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().error.code, 'ILLEGAL_TRANSITION');

    const missing = await app.inject({ method: 'POST', url: '/api/alerts/999/ack' });
    assert.equal(missing.statusCode, 404);

    // acked 期间持续越限仍只更新既有告警（部分唯一索引覆盖 firing/acked）
    await ingest(app, [{ ts: at(base, 5), value: 116 }]);
    const acked = (await app.inject({ method: 'GET', url: '/api/alerts?status=acked' })).json();
    assert.equal(acked.length, 1);
    assert.equal(acked[0].peakValue, 116);

    // 回落：acked 同样自动 resolved
    const rec = await ingest(app, [{ ts: at(base, 10), value: 90 }]);
    assert.equal(rec.json().alertsResolved.length, 1);
    assert.equal((await app.inject({ method: 'GET', url: '/api/alerts?status=resolved' })).json().length, 1);
  });
});
