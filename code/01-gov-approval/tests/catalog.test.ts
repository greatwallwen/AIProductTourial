import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from './helpers.ts';

describe('事项目录', async () => {
  const app = await createTestApp();
  after(() => app.close());

  it('列表返回事项及其材料清单与时限', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/items' });
    assert.equal(res.statusCode, 200);
    const items = res.json();
    assert.equal(items.length, 1);
    assert.equal(items[0].itemCode, 'SCJG-XK-001');
    assert.equal(items[0].itemName, '食品经营许可证新办');
    assert.equal(items[0].promiseDays, 10);
    assert.deepEqual(items[0].requiredMaterials.slice(0, 2), ['营业执照复印件', '经营场所平面布局图']);
  });

  it('按编码查询不存在的事项返回 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/items/NO-SUCH' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'ITEM_NOT_FOUND');
  });
});
