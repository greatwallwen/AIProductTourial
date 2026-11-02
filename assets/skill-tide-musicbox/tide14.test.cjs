const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const model = require('./tide14-model.js');
const raw = fs.readFileSync(`${__dirname}/recovered-14day-from-pdf.json`);
const source = JSON.parse(raw);

test('source is fixed, 14 days continuous, verified, and bound to a fingerprint', () => {
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), model.SOURCE_HASH);
  const context = model.prepare(source.data);
  assert.equal(context.days.length, 14);
  assert.equal(context.records.length, 3360);
  assert.throws(() => model.prepare(source.data.slice(1)), /3360/);
  const invalid = source.data.map(row => ({...row}));
  invalid[490].q = 'p';
  assert.throws(() => model.prepare(invalid), /质量/);
});

test('working selection stays within selected day; three independent placed passages', () => {
  const context = model.prepare(source.data);
  let draft = model.initial(context);
  assert.equal(draft.slots.length, 3);
  assert.equal(draft.slots.filter(Boolean).length, 0);
  assert.equal(model.events(context, draft.working, draft).length, 16);
  draft = model.select(context, draft, 9, 142, 30);
  assert.equal(draft.working.start, 9 * 240 + 142);
  assert.equal(model.events(context, draft.working, draft)[0].time, '2025-04-10 14:12');
  draft = model.place(context, draft, 0);
  draft = model.select(context, draft, 4, 108, 20);
  draft = model.place(context, draft, 1);
  assert.equal(draft.slots[0].start, 2302);
  assert.equal(draft.slots[1].start, 1068);
  assert.equal(draft.slots[2], null);
  draft = model.reopen(context, draft, 0);
  assert.equal(draft.working.start, 2302);
  assert.throws(() => model.select(context, draft, 1, 220, 40), /日内|边界/);
});

test('note pitch and volume change the music but never source; reopening retains edits', () => {
  const context = model.prepare(source.data);
  let draft = model.initial(context);
  const before = model.events(context, draft.working, draft)[2];
  draft = model.edit(context, draft, 2, {shift: 4, volume: 0.3});
  draft = model.place(context, draft, 0);
  draft = model.reopen(context, draft, 0);
  const after = model.events(context, draft.working, draft)[2];
  assert.equal(after.midi, before.midi + 4);
  assert.equal(after.volume, .3);
  assert.equal(after.sourceValue, before.sourceValue);
  assert.equal(source.data[64].v, '1.621');
  assert.throws(() => model.edit(context, draft, 2, {shift: 999}), /音高/);
});

test('strict recipe round-trip restores all slots and yields identical WAV', () => {
  const context = model.prepare(source.data);
  let draft = model.initial(context);
  draft = model.edit(context, draft, 1, {shift: -2, volume: .6});
  draft = model.place(context, draft, 0);
  draft = model.select(context, draft, 13, 100, 20);
  draft = model.place(context, draft, 2);
  const saved = model.toRecipe(draft);
  const restored = model.fromRecipe(context, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored, saved);
  assert.deepEqual(model.wav(context, restored), model.wav(context, draft));
  assert.equal(Buffer.from(model.wav(context, draft)).toString('ascii', 0, 4), 'RIFF');
  assert.notDeepEqual(model.wav(context, draft, 0), model.wav(context, draft, 2));
  assert.throws(() => model.fromRecipe(context, {...saved, source: 'other'}), /指纹/);
  assert.throws(() => model.fromRecipe(context, {...saved, injected: 1}), /未知字段/);
  assert.throws(() => model.fromRecipe(context, {...saved, slots: [saved.slots[0]]}), /三段/);
  assert.throws(() => model.fromRecipe(context, {...saved, working: {...saved.working, edits: {'0': {shift: 90, volume: 1}}}}), /音高/);
  assert.throws(() => model.fromRecipe(context, {...saved, title: '<img onerror=alert(1)>'.repeat(9)}), /标题/);
});

test('new melody derives contour and pace from real consecutive measurements; original mapping remains comparable', () => {
  const context = model.prepare(source.data);
  for (const [day, offset] of [[0, 60], [6, 120], [13, 180]]) {
    let draft = model.select(context, model.initial(context), day, offset, 30);
    const contour = model.events(context, draft.working, draft);
    const original = model.events(context, draft.working, {...draft, mapping: 'height'});
    assert.equal(contour.length, 16);
    assert.ok(new Set(contour.map(note => note.baseMidi)).size >= 4, `${day}: should have multiple distinct pitches`);
    assert.ok(new Set(contour.map(note => note.beats)).size > 1, `${day}: pace follows measured speed`);
    assert.deepEqual(contour.map(note => note.sourceValue), original.map(note => note.sourceValue));
    assert.deepEqual(contour.map(note => note.time), original.map(note => note.time));
    assert.ok(contour.some((note, index) => note.midi !== original[index].midi));
    assert.ok(contour.every(note => Number.isFinite(note.trend) && note.midi >= 40 && note.midi <= 80));
    draft = model.place(context, draft, 0);
    assert.notDeepEqual(model.wav(context, draft), model.wav(context, {...draft, mapping: 'height'}));
  }
});

test('v2 recipes keep the old height-only sound; v3 switch and import round-trip are deterministic', () => {
  const context = model.prepare(source.data);
  const draft = model.place(context, model.initial(context), 0);
  const legacy = {...model.toRecipe(draft), version: 2};
  delete legacy.mapping;
  const migrated = model.fromRecipe(context, legacy);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.mapping, 'height');
  assert.deepEqual(model.wav(context, migrated), model.wav(context, {...draft, mapping: 'height'}));
  const restored = model.fromRecipe(context, model.toRecipe(draft));
  assert.equal(restored.mapping, 'contour');
  assert.deepEqual(model.wav(context, restored), model.wav(context, draft));
  assert.throws(() => model.fromRecipe(context, {...draft, mapping: 'random'}), /映射/);
});

test('new composition defaults to exactly double playback speed; imported old tempo stays unchanged', () => {
  const context = model.prepare(source.data);
  const fast = model.place(context, model.initial(context), 0);
  assert.equal(fast.tempo,192);
  assert.equal(fast.mapping,'contour');
  const slow = model.validate(context, {...fast, tempo:96});
  const fastFrames=(model.wav(context,fast).byteLength-44)/2;
  const slowFrames=(model.wav(context,slow).byteLength-44)/2;
  assert.ok(Math.abs(fastFrames*2-slowFrames)<fast.slots[0].span/2+2);
  const previous = model.toRecipe(slow);
  previous.version=2;
  delete previous.mapping;
  assert.equal(model.fromRecipe(context,previous).tempo,96);
  assert.throws(()=>model.validate(context,{...fast,tempo:999}),/节拍/);
});

test('saved A/B/C listening samples reproduce from the same 48 observations and six manual edits', () => {
  const context = model.prepare(source.data);
  const recipe = JSON.parse(fs.readFileSync(`${__dirname}/十四日-演示人工改编-配方.json`, 'utf8'));
  const arrangement = model.fromRecipe(context, recipe);
  let original = model.validate(context, {...model.initial(context), mapping: 'height'});
  let newBaseline = model.initial(context);
  for (const [slot, day, offset] of [[0, 0, 60], [1, 6, 120], [2, 13, 180]]) {
    original = model.place(context, model.select(context, original, day, offset, 30), slot);
    newBaseline = model.place(context, model.select(context, newBaseline, day, offset, 30), slot);
  }
  assert.equal(arrangement.tempo, 192);
  assert.deepEqual(arrangement.slots.map(slot => [slot.start, slot.span]),
    newBaseline.slots.map(slot => [slot.start, slot.span]));
  assert.equal(arrangement.slots.reduce((total, slot) => total + Object.keys(slot.edits).length, 0), 6);
  const sourcePositions = draft => draft.slots.flatMap(slot => model.events(context, slot, draft).map(note => note.time));
  assert.equal(sourcePositions(original).length, 48);
  assert.deepEqual(sourcePositions(original), sourcePositions(newBaseline));
  assert.deepEqual(sourcePositions(newBaseline), sourcePositions(arrangement));
  const rendered = [
    ['十四日-演示原始映射.wav', original],
    ['十四日-演示新规则未改编.wav', newBaseline],
    ['十四日-演示人工改编.wav', arrangement],
  ];
  for (const [filename, draft] of rendered) {
    assert.deepEqual(Buffer.from(model.wav(context, draft)), fs.readFileSync(`${__dirname}/${filename}`));
  }
  assert.notDeepEqual(fs.readFileSync(`${__dirname}/${rendered[0][0]}`), fs.readFileSync(`${__dirname}/${rendered[1][0]}`));
  assert.notDeepEqual(fs.readFileSync(`${__dirname}/${rendered[1][0]}`), fs.readFileSync(`${__dirname}/${rendered[2][0]}`));
});
