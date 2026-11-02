import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../src/room-data.json' with { type: 'json' };
import { parseSlots } from '../src/slots.ts';

const existing = data.existingFurniture.map((item) => ({ ...item, rotation: 0 }));
const candidate = { id: 'candidate', name: '候选书桌 B', width: 120, depth: 60, x: 230, y: 105, rotation: 0 };
const valid = { A: { label: candidate.name, items: [...existing, candidate] }, B: null };

test('saved layouts restore only complete, valid room states', () => {
  assert.deepEqual(parseSlots(JSON.stringify(valid)).A?.label, '候选书桌 B');
  assert.deepEqual(parseSlots('not json'), { A: null, B: null });
  assert.deepEqual(parseSlots(null), { A: null, B: null });
});

test('local storage cannot inject invalid or stale geometry', () => {
  const overlapping = structuredClone(valid);
  overlapping.A.items[3].x = 20;
  assert.equal(parseSlots(JSON.stringify(overlapping)).A, null);
  const changedRoom = structuredClone(valid);
  changedRoom.A.items[0].width = 100;
  assert.equal(parseSlots(JSON.stringify(changedRoom)).A, null);
  const malformed = structuredClone(valid);
  malformed.A.items[3].x = 100000;
  assert.equal(parseSlots(JSON.stringify(malformed)).A, null);
});
