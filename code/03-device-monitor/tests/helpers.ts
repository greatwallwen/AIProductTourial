import { buildApp } from '../src/app.ts';

/**
 * 测试夹具：内存库 + 一台设备（液压主泵机组）+ 一条 critical 规则（主回路压力 > 110 bar）。
 * 本夹具用合成点专测写入/聚合/告警状态机的机制，与种子的真实数据集相互独立。
 * volume_flow 无规则，供纯聚合测试使用，不会误触告警。
 */
export async function createTestApp() {
  const app = await buildApp({ dbPath: ':memory:' });
  app.db
    .prepare(
      `INSERT INTO devices (device_code, name, model, vendor, gateway, location, installed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'HYD-PMP-01',
      '主泵机组',
      '轴向柱塞泵主回路',
      'ZeMA 液压试验台',
      'ZeMA 多速率采集台架 (1/10/100 Hz)',
      '一号试验台',
      new Date(Date.now() - 900 * 86_400_000).toISOString().slice(0, 10)
    );
  app.db
    .prepare(
      `INSERT INTO alert_rules (device_id, metric, op, threshold, level, title)
       VALUES (1, 'system_pressure', '>', 110, 'critical', '主回路压力超限')`
    )
    .run();
  return app;
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/** 批量上报遥测 */
export async function ingest(
  app: TestApp,
  points: Array<{ deviceCode?: string; metric?: string; ts: string; value: number }>
) {
  return await app.inject({
    method: 'POST',
    url: '/api/telemetry',
    payload: points.map((p) => ({ deviceCode: 'HYD-PMP-01', metric: 'system_pressure', ...p })),
  });
}

/** 当前小时整点起算的偏移时间戳（保证一组点落在同一个聚合桶内） */
export function hourStart(hoursOffset = 0): Date {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + hoursOffset);
  return d;
}

export function at(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}
