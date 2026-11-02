const Tide14 = (() => {
  const SOURCE_HASH = '4c3a9eeda76ad2484326b7380f0aed4ddfdb8fd929964f8dd1c78f64562fd379';
  const PDF_HASH = '7263feafed630b808a2e52d3e404ea680549653f96693cbaba95cac46a8813f3';
  const SAMPLE_RATE = 22050;
  const scales = {pentatonic: [0, 2, 4, 7, 9, 12, 14, 16], minor: [0, 2, 3, 5, 7, 8, 10, 12]};
  const scaleDegrees = {pentatonic: [0, 2, 4, 7, 9], minor: [0, 2, 3, 5, 7, 8, 10]};

  function degreeToSemitone(scale, degree) {
    const steps = scaleDegrees[scale];
    return Math.floor(degree / steps.length) * 12 + steps[((degree % steps.length) + steps.length) % steps.length];
  }

  function prepare(data) {
    if (!Array.isArray(data) || data.length !== 3360) throw new Error('来源须为 3360 条观测');
    const first = Date.UTC(2025, 3, 1);
    const records = data.map((record, index) => {
      if (record?.q !== 'v' || record?.f !== '0,0,0,0') throw new Error('观测质量未核验');
      const time = new Date(first + index * 360000).toISOString().slice(0, 16).replace('T', ' ');
      if (record.t !== time) throw new Error('观测时间不连续');
      const value = Number(record.v);
      if (!Number.isFinite(value) || value <= -20 || value >= 20) throw new Error('观测水位无效');
      return Object.freeze({time, value});
    });
    return Object.freeze({records: Object.freeze(records), min: Math.min(...records.map(item => item.value)),
      max: Math.max(...records.map(item => item.value)), days: Object.freeze(Array.from({length: 14}, (_, index) => `2025-04-${String(index + 1).padStart(2, '0')}`))});
  }

  function passage(context, entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('片段无效');
    if (Object.keys(entry).sort().join() !== 'edits,span,start') throw new Error('片段包含未知字段');
    const {start, span, edits} = entry;
    if (!Number.isInteger(start) || start < 0 || start >= context.records.length || start % 2 !== 0 ||
        ![20, 30, 40].includes(span) || start % 240 + span >= 240) throw new Error('日内片段越界或未按 12 分钟对齐');
    if (!edits || typeof edits !== 'object' || Array.isArray(edits)) throw new Error('音符编辑无效');
    const cleaned = {};
    for (const [key, edit] of Object.entries(edits)) {
      if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) > span / 2 || !edit || typeof edit !== 'object' || Array.isArray(edit)) throw new Error('音符序号无效');
      if (Object.keys(edit).sort().join() !== 'shift,volume') throw new Error('音符包含未知字段');
      if (!Number.isInteger(edit.shift) || Math.abs(edit.shift) > 12) throw new Error('音高限定 ±12 半音');
      if (typeof edit.volume !== 'number' || !Number.isFinite(edit.volume) || edit.volume < 0 || edit.volume > 1) throw new Error('音量超出边界');
      cleaned[key] = {shift: edit.shift, volume: edit.volume};
    }
    return {start, span, edits: cleaned};
  }

  function initial(context) {
    return validate(context, {version: 3, source: SOURCE_HASH, sourcePdf: PDF_HASH, title: '旧金山 · 十四日潮汐练习曲',
      scale: 'pentatonic', mapping: 'contour', tempo: 192, tone: 'warm', layer: true,
      working: {start: 60, span: 30, edits: {}}, slots: [null, null, null]});
  }

  function validate(context, draft) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft) || ![2, 3].includes(draft.version)) throw new Error('配方版本无效');
    const legacy = draft.version === 2;
    const fields = legacy ? 'layer,scale,slots,source,sourcePdf,tempo,title,tone,version,working' : 'layer,mapping,scale,slots,source,sourcePdf,tempo,title,tone,version,working';
    if (Object.keys(draft).sort().join() !== fields) throw new Error('配方包含未知字段');
    if (draft.source !== SOURCE_HASH || draft.sourcePdf !== PDF_HASH) throw new Error('来源指纹不匹配');
    if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 60 || /[\u0000-\u001f<>]/.test(draft.title)) throw new Error('标题无效');
    if (!Object.hasOwn(scales, draft.scale)) throw new Error('音阶无效');
    const mapping = legacy ? 'height' : draft.mapping;
    if (!['height', 'contour'].includes(mapping)) throw new Error('音乐映射无效');
    if (![72, 80, 96, 112, 120, 144, 160, 192, 224, 240].includes(draft.tempo)) throw new Error('节拍无效');
    if (!['warm', 'bright'].includes(draft.tone) || typeof draft.layer !== 'boolean') throw new Error('音色无效');
    if (!Array.isArray(draft.slots) || draft.slots.length !== 3) throw new Error('必须有三段槽位');
    return {version: 3, source: SOURCE_HASH, sourcePdf: PDF_HASH, title: draft.title, scale: draft.scale, mapping,
      tempo: draft.tempo, tone: draft.tone, layer: draft.layer, working: passage(context, draft.working),
      slots: draft.slots.map(slot => slot === null ? null : passage(context, slot))};
  }

  function select(context, draft, day, offset, span) {
    if (!Number.isInteger(day) || day < 0 || day > 13 || !Number.isInteger(offset)) throw new Error('日期或位置无效');
    return validate(context, {...draft, working: {start: day * 240 + offset, span, edits: {}}});
  }
  function edit(context, draft, index, change) {
    if (!Number.isInteger(index) || index < 0 || index > draft.working.span / 2) throw new Error('音符序号无效');
    const previous = draft.working.edits[index] || {shift: 0, volume: 1};
    const next = {...previous, ...change};
    return validate(context, {...draft, working: {...draft.working, edits: {...draft.working.edits, [index]: next}}});
  }
  function restore(context, draft, index) {
    if (!Number.isInteger(index) || index < 0 || index > draft.working.span / 2) throw new Error('音符序号无效');
    const edits = {...draft.working.edits};
    delete edits[index];
    return validate(context, {...draft, working: {...draft.working, edits}});
  }
  function place(context, draft, slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('槽位无效');
    return validate(context, {...draft, slots: draft.slots.map((item, index) => index === slot ? draft.working : item)});
  }
  function reopen(context, draft, slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2 || !draft.slots[slot]) throw new Error('槽位为空');
    return validate(context, {...draft, working: draft.slots[slot]});
  }
  function clear(context, draft, slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('槽位无效');
    return validate(context, {...draft, slots: draft.slots.map((item, index) => index === slot ? null : item)});
  }
  function events(context, entry, draft) {
    const clip = passage(context, entry);
    const trends = Array.from({length: clip.span / 2 + 1}, (_, index) => index === 0 ? 0 :
      context.records[clip.start + index * 2].value - context.records[clip.start + (index - 1) * 2].value);
    const fastest = Math.max(...trends.map(Math.abs), .001);
    const score = [];
    for (let index = 0; index <= clip.span / 2; index++) {
      const current = context.records[clip.start + index * 2];
      const previous = context.records[Math.max(0, clip.start + index * 2 - 2)];
      const step = Math.min(7, Math.floor((current.value - context.min) / (context.max - context.min) * 8));
      const normalizedSpeed = trends[index] / fastest;
      const contourStep = Math.round(normalizedSpeed * 3);
      const baseMidi = draft.mapping === 'contour'
        ? 48 + degreeToSemitone(draft.scale, step + contourStep)
        : 48 + scales[draft.scale][step];
      const beats = draft.mapping === 'contour' ? (Math.abs(normalizedSpeed) >= .7 ? 1.5 : Math.abs(normalizedSpeed) >= .35 ? 1.75 : 2.25) : 2;
      const change = clip.edits[index] || {shift: 0, volume: 1};
      score.push({index, time: current.time, sourceValue: current.value, baseMidi, midi: baseMidi + change.shift,
        volume: change.volume, slope: current.value - previous.value, trend: trends[index], beats,
        mapping: draft.mapping, edited: Object.hasOwn(clip.edits, index)});
    }
    return score;
  }
  function sequence(context, draft, slot) {
    if (slot !== undefined) {
      if (![0, 1, 2].includes(slot) || !draft.slots[slot]) throw new Error('该段尚未放入作品');
      return events(context, draft.slots[slot], draft);
    }
    const sections = draft.slots.filter(Boolean).map(entry => events(context, entry, draft));
    if (!sections.length) throw new Error('请先放入至少一段');
    return sections.flat();
  }
  function toRecipe(draft) {
    return JSON.parse(JSON.stringify(draft));
  }
  function fromRecipe(context, recipe) {
    return validate(context, recipe);
  }
  function wav(context, draft, slot) {
    const score = sequence(context, draft, slot);
    const noteFrames = score.map(note => Math.round(note.beats * 60 / draft.tempo * SAMPLE_RATE));
    const frames = noteFrames.reduce((total, length) => total + length, 0);
    const bytes = new Uint8Array(44 + frames * 2);
    const view = new DataView(bytes.buffer);
    for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']]) {
      for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
    }
    view.setUint32(4, bytes.length - 8, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, frames * 2, true);
    let frameOffset = 0;
    score.forEach((note, noteIndex) => {
      const framesPerNote = noteFrames[noteIndex];
      const frequency = 440 * Math.pow(2, (note.midi - 69) / 12);
      for (let index = 0; index < framesPerNote; index++) {
        const seconds = index / SAMPLE_RATE;
        const length = framesPerNote / SAMPLE_RATE;
        const envelope = Math.max(0, Math.min(1, seconds / .025, (length - seconds) / .14));
        const angle = 2 * Math.PI * frequency * seconds;
        const primary = Math.sin(angle) + (draft.tone === 'bright' ? .32 : .12) * Math.sin(2 * angle);
        const accent = draft.layer ? Math.min(1, Math.abs(note.slope) * 5) * .08 * Math.sin(angle * 1.5) : 0;
        const amplitude = Math.max(-1, Math.min(1, (primary * .27 + accent) * envelope * note.volume));
        view.setInt16(44 + (frameOffset + index) * 2, Math.round(amplitude * 32767), true);
      }
      frameOffset += framesPerNote;
    });
    return bytes;
  }
  return {SOURCE_HASH, PDF_HASH, prepare, initial, validate, select, edit, restore, place, reopen, clear, events, sequence, toRecipe, fromRecipe, wav};
})();
if (typeof module !== 'undefined') module.exports = Tide14;
