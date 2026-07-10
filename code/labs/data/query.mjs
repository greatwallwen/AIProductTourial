#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const fixtureAt = process.argv.indexOf('--fixture');
const fixture = fixtureAt >= 0 ? process.argv[fixtureAt + 1] : '';
if (fixture !== 'defi-risk') {
  console.error('only the allowlisted defi-risk fixture is available');
  process.exit(1);
}
const path = resolve(ROOT, 'course/fixtures/data/defi-risk.csv');
const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
const fields = header.split(',');
const rows = lines.map((line) => Object.fromEntries(line.split(',').map((value, index) => [fields[index], index === 0 ? value : Number(value)])));
const selected = rows
  .filter((row) => row.error_rate >= 0.05 || row.concentration >= 0.55)
  .map((row) => ({ ...row, risk_score: Math.round((row.error_rate * 100 + row.concentration * 10) * 100) / 100 }))
  .sort((a, b) => b.risk_score - a.risk_score);
const resultHash = `sha256:${createHash('sha256').update(JSON.stringify(selected)).digest('hex')}`;
console.log(JSON.stringify({
  schema: 'dataset-query-evidence/v1',
  queryId: 'defi-risk-sql',
  fixture: 'course/fixtures/data/defi-risk.csv',
  profile: { rows: rows.length, fields, synthetic: true, nulls: 0 },
  predicate: 'error_rate >= 0.05 OR concentration >= 0.55',
  selected,
  resultHash,
  decisionBoundary: 'teaching signal only; an owner must review before any intervention',
  ok: selected.length === 3
}, null, 2));
