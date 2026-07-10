#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadCourseContract, ROOT, sha256, validateCourseContract } from './course_contract.mjs';

const contract = loadCourseContract();
const findings = validateCourseContract(contract).map((item) => ({ severity: 'HIGH', category: 'contract', ...item }));
const add = (severity, category, code, detail) => findings.push({ severity, category, code, detail });
const { manifest, activities, visuals } = contract;

for (const path of visuals.ownedDiagrams) {
  if (!existsSync(resolve(ROOT, path))) add('HIGH', 'visual', 'missing-owned-diagram', path);
  const target = `assets/course/image2/diagrams/${path.split('/').at(-1).replace(/\.svg$/i, '.png')}`;
  if (!existsSync(resolve(ROOT, target))) add('HIGH', 'visual', 'image2-diagram-pending', target);
}
for (const item of visuals.image2Replacements) {
  if (!existsSync(resolve(ROOT, item.source))) add('HIGH', 'visual', 'missing-image2-source', item.source);
  if (!existsSync(resolve(ROOT, item.target))) add('HIGH', 'visual', 'image2-target-pending', item.target);
}
for (const path of visuals.runtimeScreenshots) {
  if (!existsSync(resolve(ROOT, path))) add('HIGH', 'visual', 'missing-runtime-screenshot', path);
  const sidecar = path.replace(/\.png$/i, '.json');
  if (!existsSync(resolve(ROOT, sidecar))) add('HIGH', 'visual', 'missing-screenshot-sidecar', sidecar);
}

const source = readFileSync(resolve(ROOT, 'code/tools/check_my_work.mjs'), 'utf8');
if (/doc\.includes\(/.test(source)) add('MED', 'assessment', 'legacy-keyword-checker', 'legacy case checker still accepts keyword presence; required activities use structured attempts instead');
const visualReceiptPath = resolve(ROOT, 'assets/course/image2/manifest.json');
if (!existsSync(visualReceiptPath)) add('HIGH', 'visual', 'visual-receipt-missing', 'assets/course/image2/manifest.json');
else {
  const visualReceipt = JSON.parse(readFileSync(visualReceiptPath, 'utf8'));
  if (!visualReceipt.ok || visualReceipt.summary?.image2 !== 43) add('HIGH', 'visual', 'visual-receipt-invalid', visualReceipt.summary);
}
const activityKinds = new Set(activities.activities.map((activity) => activity.kind));
if (activityKinds.size < 8) add('MED', 'practice', 'activity-variety', `${activityKinds.size} distinct activity kinds`);
if ((manifest.legacyCasePolicy?.coreVerticals ?? []).length !== 3) add('HIGH', 'redundancy', 'legacy-case-clustering', 'expected three vertical practice chains');

const counts = findings.reduce((result, item) => ({ ...result, [item.severity]: (result[item.severity] ?? 0) + 1 }), {});
const report = {
  schema: 'learning-course-audit/v1',
  courseId: manifest.id,
  version: manifest.version,
  summary: {
    modules: manifest.modules.length,
    requiredActivities: activities.activities.filter((item) => item.required).length,
    durationMinutes: manifest.durationMinutes,
    practiceMinutes: manifest.practiceMinutes,
    practiceRatio: Math.round(manifest.practiceMinutes / manifest.durationMinutes * 1000) / 1000,
    activityKinds: activityKinds.size,
    ownedDiagrams: visuals.ownedDiagrams.length,
    image2Replacements: visuals.image2Replacements.length,
    runtimeScreenshots: visuals.runtimeScreenshots.length,
    findings: findings.length,
    counts
  },
  findings,
  contractHash: sha256(contract),
  ok: (counts.HIGH ?? 0) === 0
};
const target = resolve(ROOT, 'outputs/course_audit.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
