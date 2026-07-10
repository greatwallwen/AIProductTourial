import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { evaluateAttempt, loadCourseContract, validateCourseContract } from './course_contract.mjs';
import { runBoundedLoop } from '../labs/loop/engine.mjs';
import { ROOT } from './course_contract.mjs';

test('course contract has 6 modules, 12 required activities, and at least 60 percent practice', () => {
  const contract = loadCourseContract();
  assert.deepEqual(validateCourseContract(contract), []);
  assert.equal(contract.manifest.modules.length, 6);
  assert.equal(contract.activities.activities.filter((activity) => activity.required).length, 12);
  assert.ok(contract.manifest.practiceMinutes / contract.manifest.durationMinutes >= 0.6);
});

test('keyword stuffing cannot satisfy a structured learning attempt', () => {
  const { activities } = loadCourseContract();
  const activity = activities.activities.find((item) => item.id === 'act-01-sensor-contract');
  const stuffed = 'goal signals failureLocation stopCondition';
  const result = evaluateAttempt(activity, stuffed);
  assert.equal(result.ok, false);
  assert.equal(result.score, 0);
});

test('bounded loop converges with evidence and stops on a repeated failure', () => {
  const success = runBoundedLoop('converge');
  const stopped = runBoundedLoop('repeated-failure');
  assert.equal(success.stopReason, 'all-green');
  assert.equal(success.cycles.length, 2);
  assert.match(success.traceHash, /^sha256:/);
  assert.equal(stopped.stopReason, 'repeated-failure');
  assert.equal(stopped.cycles.length, 2);
  assert.equal(stopped.escalationPacket.owner, 'course-owner');
});

test('published visual catalog resolves every slide asset to an image2 receipt', () => {
  const packagePath = resolve(ROOT, 'outputs/html-ppt/ai-product-loop-course-package.json');
  const course = JSON.parse(readFileSync(packagePath, 'utf8'));
  const assets = new Set(course.visualCatalog.assets.map((item) => item.id));
  const referenced = course.slideAst.flatMap((slide) => slide.visualBinding.assetIds);
  assert.ok(referenced.length > 0);
  assert.deepEqual(referenced.filter((id) => !assets.has(id)), []);
  assert.equal(course.publishGate.visualApproved, true);
});
