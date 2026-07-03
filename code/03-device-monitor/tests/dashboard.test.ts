import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, ingest, hourStart, at, type TestApp } from './helpers.ts';

describe('聚合查询与看板接口', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  it('bucket=hour：avg=sum/cnt，min/max/cnt 逐桶正确', async () => {
    const hourA = hourStart(-3);
    const hourB = hourStart(-2);
    await ingest(app, [
      { metric: 'volume_flow', ts: at(hourA, 0), value: 7.0 },
      { metric: 'volume_flow', ts: at(hourA, 20), value: 7.5 },
      { metric: 'volume_flow', ts: at(hourA, 40), value: 8.0 },
      { metric: 'volume_flow', ts: at(hourB, 10), value: 9.0 },
      { metric: 'volume_flow', ts: at(hourB, 30), value: 10.0 },
    ]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/HYD-PMP-01/metrics?metric=volume_flow&from=${at(hourA, 0)}&to=${at(hourB, 59)}&bucket=hour`,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.bucket, 'hour');
    assert.equal(body.points.length, 2);
    const [a, b] = body.points;
    assert.equal(a.hourTs, hourA.toISOString());
    assert.equal(a.cnt, 3);
    assert.ok(Math.abs(a.avg - 7.5) < 1e-9, 'avg 应为 sum/cnt=22.5/3');
    assert.equal(a.min, 7.0);
    assert.equal(a.max, 8.0);
    assert.equal(b.cnt, 2);
    assert.ok(Math.abs(b.avg - 9.5) < 1e-9);
  });

  it('bucket 未指定时按跨度自动选粒度：>6h 走 hour，短窗走 raw', async () => {
    const base = hourStart(-1);
    await ingest(app, [
      { metric: 'volume_flow', ts: at(base, 0), value: 7.2 },
      { metric: 'volume_flow', ts: at(base, 5), value: 7.4 },
    ]);
    // 默认窗口（最近 24 小时）→ 自动小时聚合
    const wide = (
      await app.inject({ method: 'GET', url: '/api/devices/HYD-PMP-01/metrics?metric=volume_flow' })
    ).json();
    assert.equal(wide.bucket, 'hour');
    assert.equal(wide.points.length, 1);
    // 显式 2 小时窗口 → 自动原始点
    const from = at(hourStart(-2), 0);
    const narrow = (
      await app.inject({
        method: 'GET',
        url: `/api/devices/HYD-PMP-01/metrics?metric=volume_flow&from=${from}`,
      })
    ).json();
    assert.equal(narrow.bucket, 'raw');
    assert.equal(narrow.points.length, 2);
    assert.deepEqual(narrow.points[0], { ts: at(base, 0), value: 7.2 });
  });

  it('summary：近 1 小时各指标聚合与最新读数（看板卡片数据源）', async () => {
    const now = Date.now();
    await ingest(app, [
      { metric: 'volume_flow', ts: new Date(now - 40 * 60_000).toISOString(), value: 7.1 },
      { metric: 'volume_flow', ts: new Date(now - 20 * 60_000).toISOString(), value: 7.7 },
      { metric: 'cooling_power', ts: new Date(now - 10 * 60_000).toISOString(), value: 63 },
      // 2 小时前的点不应计入近 1 小时聚合
      { metric: 'volume_flow', ts: new Date(now - 2 * 3600_000).toISOString(), value: 5.0 },
    ]);
    const res = await app.inject({ method: 'GET', url: '/api/devices/HYD-PMP-01/summary' });
    assert.equal(res.statusCode, 200);
    const { metrics } = res.json();
    const pressure = metrics.find((m: { metric: string }) => m.metric === 'volume_flow');
    assert.equal(pressure.cnt, 2, '窗口外的点不应计入');
    assert.ok(Math.abs(pressure.avg - 7.4) < 1e-9);
    assert.equal(pressure.last, 7.7, '最新读数取 ts 最大的一行');
    const current = metrics.find((m: { metric: string }) => m.metric === 'cooling_power');
    assert.equal(current.last, 63);
  });

  it('未注册设备查询：404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices/NO-SUCH/metrics?metric=volume_flow',
    });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'DEVICE_NOT_FOUND');
  });
});
