import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(import.meta.dirname, 'lab.tsx'), 'utf8');
describe('AI 概念实验室', () => {
  it('四个实验室都在（tokenizer / context / rag / agent）', () => { for (const k of ['tokenizer', 'context', 'rag', 'agent']) expect(src).toContain(k); });
});
