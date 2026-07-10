#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const targetArg = process.argv[2];
const expectBlocked = process.argv.includes('--expect-blocked');
if (!targetArg) {
  console.error('usage: node code/labs/skills/validate.mjs <SKILL.md> [--expect-blocked]');
  process.exit(1);
}
const target = resolve(ROOT, targetArg);
if (!target.startsWith(`${ROOT}\\`) && !target.startsWith(`${ROOT}/`)) {
  console.error('skill path must stay inside the repository');
  process.exit(1);
}

const text = readFileSync(target, 'utf8');
const findings = [];
const add = (severity, rule, detail) => findings.push({ severity, rule, detail });
const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const meta = Object.fromEntries((frontmatter?.[1] ?? '').split(/\r?\n/).map((line) => line.split(/:\s+/, 2)).filter((parts) => parts.length === 2));
if (!meta.name || !/^[a-z0-9-]{1,64}$/.test(meta.name)) add('MED', 'metadata.name', 'name must use lower-case letters, digits, and hyphens');
if (!meta.description || meta.description.length < 40) add('MED', 'metadata.description', 'description must say what the skill does and when to use it');
for (const heading of ['## Trigger', '## Workflow', '## Verification']) if (!text.includes(heading)) add('MED', 'progressive-disclosure', `missing ${heading}`);
if (text.split(/\r?\n/).length > 500) add('MED', 'size', 'SKILL.md exceeds 500 lines');
const dangerous = [
  [/ignore\s+(all\s+)?previous\s+instructions/i, 'prompt-injection'],
  [/(upload|exfiltrate).{0,30}(secret|credential|token)/i, 'credential-exfiltration'],
  [/(curl|wget)\s+[^\n|]*\|\s*(sh|bash|node|python)/i, 'remote-pipe-execution'],
  [/(cat|send|upload).{0,30}(\.env|id_rsa|\.ssh)/i, 'sensitive-file-access']
];
for (const [pattern, rule] of dangerous) if (pattern.test(text)) add('HIGH', rule, 'unsafe instruction found');

const references = [...text.matchAll(/`(references\/[^`]+)`/g)].map((match) => match[1]);
for (const ref of references) {
  if (ref.split('/').length !== 2) add('MED', 'reference-depth', `${ref} is more than one level deep`);
  try { statSync(resolve(dirname(target), ref)); } catch { add('MED', 'reference-missing', ref); }
}
const blocked = findings.some((item) => item.severity === 'HIGH' || item.severity === 'MED');
const report = {
  schema: 'skill-validation-report/v1',
  skill: relative(ROOT, target).replace(/\\/g, '/'),
  metadata: meta,
  loadedResources: [relative(ROOT, target).replace(/\\/g, '/')],
  discoveredResources: references,
  findings,
  blocked,
  expectedBlocked: expectBlocked,
  ok: expectBlocked ? blocked : !blocked
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
