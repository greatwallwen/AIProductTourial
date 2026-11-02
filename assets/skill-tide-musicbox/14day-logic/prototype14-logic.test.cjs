const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Tide14 = require('../tide14-model.js');
const Trial = require('./prototype14-logic-core.js');

const source = JSON.parse(fs.readFileSync(`${__dirname}/../recovered-14day-from-pdf.json`, 'utf8'));
const context = Tide14.prepare(source.data);

test('same 14-day source and 192 bpm reveal distinct rule behavior without changing observations', () => {
  let draft = Trial.initial(context);
  assert.equal(context.records.length, 3360);
  const original = source.data.map(record => record.v);
  for (const [slot, day, offset] of [[0, 0, 60], [1, 6, 120], [2, 13, 180]]) {
    draft = Trial.act(context, draft, {type: 'select', day, offset});
    const comparison = Trial.compare(context, draft);
    assert.deepEqual(comparison.old.map(note => [note.time, note.sourceValue]),
      comparison.new.map(note => [note.time, note.sourceValue]));
    assert.equal(comparison.old.length, 16);
    assert.ok(comparison.new.some((note, index) => note.midi !== comparison.old[index].midi));
    if (slot === 0) {
      assert.equal(comparison.old[1].time, '2025-04-01 06:12');
      assert.equal(comparison.new[1].sourceValue, 1.555);
      assert.equal(Number(comparison.new[1].trend.toFixed(3)), .064);
      assert.equal(comparison.old[1].midi, 62);
      assert.equal(comparison.new[1].midi, 67);
      assert.equal(comparison.new[1].beats, 1.5);
    }
    draft = Trial.act(context, draft, {type: 'place', slot});
  }
  assert.deepEqual(source.data.map(record => record.v), original);
  assert.deepEqual(draft.slots.map(slot => slot.start), [60, 1560, 3300]);
  assert.deepEqual(draft.slots.map(slot => new Set(Trial.compare(context, {...draft, working: slot}).old.map(note => note.midi)).size), [3, 3, 3]);
  assert.deepEqual(draft.slots.map(slot => new Set(Trial.compare(context, {...draft, working: slot}).new.map(note => note.midi)).size), [4, 5, 4]);
  assert.equal(draft.tempo, 192);
});

test('human edit is separate from the source and does not silently overwrite a placed passage', () => {
  let draft = Trial.act(context, Trial.initial(context), {type: 'place', slot: 0});
  const oldSlot = draft.slots[0];
  draft = Trial.act(context, draft, {type: 'edit', index: 2, shift: 4, volume: .8});
  assert.equal(Trial.compare(context, draft).new[2].edited, true);
  assert.equal(draft.slots[0].edits[2], undefined);
  draft = Trial.act(context, draft, {type: 'place', slot: 0});
  assert.equal(draft.slots[0].edits[2].shift, 4);
  assert.equal(draft.slots[0].edits[2].volume, .8);
  assert.deepEqual(oldSlot.edits, {});
  draft = Trial.act(context, draft, {type: 'select', day: 6, offset: 120});
  assert.equal(draft.slots[0].start, 60);
  assert.equal(Trial.act(context, draft, {type: 'reopen', slot: 0}).working.edits[2].shift, 4);
});

test('invalid selections and injected bad-quality rows are rejected without corrupting source', () => {
  const draft = Trial.initial(context);
  assert.throws(() => Trial.act(context, draft, {type: 'select', day: 13, offset: 238}), /越界/);
  assert.equal(draft.working.start, 60);
  assert.throws(() => Trial.rejectInjectedQuality(source.data), /质量/);
  assert.equal(source.data[0].q, 'v');
  assert.throws(() => Trial.act(context, draft, {type: 'place', slot: 4}), /槽位/);
});
