import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const nonEmpty = (value) => value !== null && value !== undefined && (typeof value !== 'string' || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0);

export function sha256(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')}`;
}

export function loadCourseContract() {
  const manifest = readJson('course/manifest.json');
  return {
    manifest,
    activities: readJson(manifest.sourceFiles.activities),
    rubrics: readJson(manifest.sourceFiles.rubrics),
    visuals: readJson(manifest.sourceFiles.visuals),
    datasets: readJson(manifest.sourceFiles.datasets)
  };
}

export function validateCourseContract(contract = loadCourseContract()) {
  const errors = [];
  const add = (code, detail) => errors.push({ code, detail });
  const { manifest, activities, rubrics, visuals, datasets } = contract;
  if (manifest.schema !== 'course-material/v1') add('manifest-schema', manifest.schema);
  if (activities.schema !== 'learning-activity-catalog/v1') add('activities-schema', activities.schema);
  if (rubrics.schema !== 'assessment-rubric-catalog/v1') add('rubrics-schema', rubrics.schema);
  if (visuals.schema !== 'course-visual-manifest/v1') add('visuals-schema', visuals.schema);
  if (datasets.schema !== 'course-dataset-catalog/v1') add('datasets-schema', datasets.schema);

  const activityById = new Map();
  for (const activity of activities.activities ?? []) {
    if (activityById.has(activity.id)) add('duplicate-activity', activity.id);
    activityById.set(activity.id, activity);
  }
  const rubricById = new Map((rubrics.rubrics ?? []).map((rubric) => [rubric.id, rubric]));
  const knownJobTypes = new Set(['python_snippet', 'dataset_sql', 'chart_build', 'rag_query', 'doc_export', 'loop_run', 'skill_validate', 'mcp_probe']);
  let duration = 0;
  let practice = 0;
  for (const module of manifest.modules ?? []) {
    duration += module.durationMinutes ?? 0;
    practice += module.practiceMinutes ?? 0;
    if (!existsSync(resolve(ROOT, module.labRef ?? ''))) add('missing-lab', module.labRef);
    if ((module.activityRefs ?? []).length < 2) add('thin-module', module.id);
    for (const activityId of module.activityRefs ?? []) {
      const activity = activityById.get(activityId);
      if (!activity) add('missing-activity', `${module.id}:${activityId}`);
      else if (activity.moduleId !== module.id) add('activity-module-mismatch', `${activityId}:${activity.moduleId}`);
    }
  }
  if (duration !== manifest.durationMinutes) add('duration-mismatch', `${duration}:${manifest.durationMinutes}`);
  if (practice !== manifest.practiceMinutes) add('practice-mismatch', `${practice}:${manifest.practiceMinutes}`);
  if (practice / Math.max(duration, 1) < 0.6) add('practice-ratio', practice / duration);

  const required = (activities.activities ?? []).filter((activity) => activity.required);
  if (required.length !== manifest.requiredActivityCount) add('required-activity-count', `${required.length}:${manifest.requiredActivityCount}`);
  for (const activity of required) {
    for (const field of ['moduleId', 'title', 'kind', 'validator', 'command', 'runtimeJob', 'submission', 'evidence', 'rubricId']) {
      if (!nonEmpty(activity[field])) add('activity-field', `${activity.id}:${field}`);
    }
    if (!knownJobTypes.has(activity.runtimeJob?.type)) add('runtime-job-type', `${activity.id}:${activity.runtimeJob?.type}`);
    if (!activity.evidence?.required || !(activity.evidence.types?.length > 0)) add('evidence-contract', activity.id);
    const roleSet = new Set(activity.roleCoverage ?? []);
    for (const role of manifest.completionPolicy.requiredRoleReviews) if (!roleSet.has(role)) add('activity-role-coverage', `${activity.id}:${role}`);
    const rubric = rubricById.get(activity.rubricId);
    if (!rubric) add('missing-rubric', `${activity.id}:${activity.rubricId}`);
    else {
      const rubricRoles = new Set(rubric.criteria.map((criterion) => criterion.role));
      for (const role of manifest.completionPolicy.requiredRoleReviews) if (!rubricRoles.has(role)) add('rubric-role-coverage', `${rubric.id}:${role}`);
      const weight = rubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
      if (weight !== 100) add('rubric-weight', `${rubric.id}:${weight}`);
    }
  }
  for (const dataset of datasets.datasets ?? []) {
    if (dataset.fixturePath && !existsSync(resolve(ROOT, dataset.fixturePath))) add('missing-dataset-fixture', dataset.fixturePath);
    if (dataset.recipePath && !existsSync(resolve(ROOT, dataset.recipePath))) add('missing-dataset-recipe', dataset.recipePath);
  }
  return errors;
}

export function evaluateAttempt(activity, submission) {
  const required = activity.submission?.requiredFields ?? [];
  const format = activity.submission?.format;
  if (format === 'json') {
    if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
      return { ok: false, score: 0, missing: required, reason: 'submission must be a structured JSON object' };
    }
    const missing = required.filter((field) => !nonEmpty(submission[field]));
    return { ok: missing.length === 0, score: missing.length ? Math.max(0, 100 - missing.length * 20) : 100, missing, reason: missing.length ? 'required structured fields are missing' : 'structured fields are present' };
  }
  if (format === 'markdown') {
    const text = typeof submission === 'string' ? submission : '';
    const requiredPatterns = [/^---/m, /name:\s*[a-z0-9-]+/i, /description:\s*.{30,}/i, /##\s+Trigger/i, /##\s+Workflow/i, /##\s+Verification/i];
    const missing = requiredPatterns.map((pattern, index) => pattern.test(text) ? null : required[index] ?? `pattern-${index}`).filter(Boolean);
    return { ok: missing.length === 0, score: missing.length ? Math.max(0, 100 - missing.length * 15) : 100, missing, reason: missing.length ? 'markdown structure is incomplete' : 'skill structure is present' };
  }
  return { ok: false, score: 0, missing: required, reason: `unsupported submission format: ${format}` };
}
