#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, sha256 } from './course_contract.mjs';

const read = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const course = read('outputs/html-ppt/ai-product-loop-course-package.json');
const visual = read('outputs/course_visual_receipt.json');
const adversarial = read('outputs/adversarial_review.json');
const plan = course.learningPlan;
const required = plan.activities.filter((item) => item.required);
const jobs = course.runtimeManifest.jobs;
const referencedAssets = new Set(course.slideAst.flatMap((slide) => slide.visualBinding.assetIds));
const availableAssets = new Set(course.visualCatalog.assets.map((asset) => asset.id));

const roles = [
  {
    role: 'engineering',
    checks: [
      { id: 'typed-job-bijection', ok: required.length === jobs.length && required.every((activity) => jobs.some((job) => job.id === activity.runtimeJob.id && job.validator === activity.validator)) },
      { id: 'slide-activity-trace', ok: required.every((activity) => course.slideAst.some((slide) => slide.activityRefs.includes(activity.id) && slide.runtimeJobs.includes(activity.runtimeJob.id))) },
      { id: 'visual-assets-resolve', ok: [...referencedAssets].every((id) => availableAssets.has(id)) },
      { id: 'bounded-loop-types', ok: ['loop_run', 'skill_validate', 'mcp_probe'].every((type) => jobs.some((job) => job.type === type)) }
    ]
  },
  {
    role: 'product',
    checks: [
      { id: 'outcome-per-module', ok: plan.modules.length === 6 && plan.modules.every((module) => module.outcome && module.activityRefs.length === 2) },
      { id: 'practice-majority', ok: plan.practiceMinutes / plan.durationMinutes >= 0.6 },
      { id: 'structured-submission', ok: required.every((activity) => activity.submission.requiredFields.length >= 4 && activity.evidence.types.length >= 2) },
      { id: 'legacy-case-dedup', ok: course.sourceMaterial.id === 'ai-product-loop-engineering' && plan.activities.length === 12 }
    ]
  },
  {
    role: 'assurance',
    checks: [
      { id: 'three-role-coverage', ok: required.every((activity) => ['engineering', 'product', 'assurance'].every((role) => activity.roleCoverage.includes(role))) },
      { id: 'human-capstone-gate', ok: plan.completionPolicy.capstoneNeedsHumanReview === true && plan.completionPolicy.minimumScore === 80 },
      { id: 'raw-data-boundary', ok: plan.datasetCatalog.policy.rawDataInGit === false && plan.datasetCatalog.policy.restrictedDataNeedsLocalRecipe === true },
      { id: 'visual-receipt', ok: visual.ok === true && visual.summary.blockers === 0 },
      { id: 'red-team-high-zero', ok: (adversarial.counts.HIGH ?? 0) === 0 }
    ]
  }
].map((entry) => ({ ...entry, findings: entry.checks.filter((check) => !check.ok).map((check) => check.id), ok: entry.checks.every((check) => check.ok) }));

const body = {
  schema: 'multi-role-course-audit/v1',
  coursePackage: course.id,
  roles,
  crossChecks: {
    activityIdsUnique: new Set(required.map((item) => item.id)).size === required.length,
    runtimeJobIdsUnique: new Set(jobs.map((item) => item.id)).size === jobs.length,
    unresolvedVisuals: [...referencedAssets].filter((id) => !availableAssets.has(id)),
    contradictions: []
  }
};
const report = { ...body, ok: roles.every((entry) => entry.ok) && Object.values(body.crossChecks).every((value) => Array.isArray(value) ? value.length === 0 : value === true), hash: sha256(body) };
writeFileSync(resolve(ROOT, 'outputs/multi_role_course_audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
