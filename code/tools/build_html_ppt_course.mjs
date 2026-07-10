#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadCourseContract, ROOT, sha256, validateCourseContract } from './course_contract.mjs';

const contract = loadCourseContract();
const errors = validateCourseContract(contract);
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
const { manifest, activities, rubrics, visuals, datasets } = contract;
const visualReceipt = JSON.parse(readFileSync(resolve(ROOT, 'assets/course/image2/manifest.json'), 'utf8'));
if (visualReceipt.ok !== true || visualReceipt.blockers?.length) {
  throw new Error('course visual receipt is not publishable');
}
const visualAssets = [...visualReceipt.items, ...visualReceipt.screenshots].map((item) => ({
  id: item.id,
  kind: item.kind,
  path: item.target,
  hash: item.targetHash,
  width: item.width,
  height: item.height,
  generatedBy: item.generatedBy
}));
const activityById = new Map(activities.activities.map((activity) => [activity.id, activity]));
const slides = [];
const push = (kind, title, content, module, activity) => {
  const order = slides.length + 1;
  const runtimeJobs = activity?.runtimeJob ? [activity.runtimeJob.id] : [];
  slides.push({
    id: `slide-${String(order).padStart(2, '0')}`,
    kind,
    content: { title, ...content, sourceCards: module ? [`card-${module.id}`] : [] },
    presenter: { notes: content.notes ?? '', layout: { fontFamily: 'system', fontScale: 1, notesBox: { x: 0.04, y: 0.66, w: 0.92, h: 0.28 }, railMode: 'normal', theme: 'light' } },
    runtimeJobs,
    activityRefs: activity ? [activity.id] : [],
    visualBinding: {
      template: kind === 'demo-step' ? 'workshop-proof' : kind === 'review' ? 'review-grid' : 'evidence-brief',
      atomRefs: module ? [`atom-${module.id}`] : [],
      assetIds: module?.figureRefs?.slice(0, 1) ?? [],
      motion: kind === 'demo-step' ? 'guided' : 'subtle',
      status: 'ready',
      densityMode: kind === 'demo-step' ? 'evidence-first' : 'speaker-led'
    },
    evidenceRefs: activity ? activity.evidence.types.map((type) => `learning-evidence://${activity.id}/${type}`) : []
  });
};

push('cover', manifest.title, { subtitle: manifest.promise, notes: '先交代课程承诺、结业证据和人工复核边界。' });
push('agenda', '两天只走一条闭环', { bullets: manifest.modules.map((module) => module.title), notes: '九个旧案例重组为三条纵向链，不逐案重复跟做。' });
for (const module of manifest.modules) {
  push('problem-solution', module.title, { outcome: module.outcome, durationMinutes: module.durationMinutes, practiceMinutes: module.practiceMinutes, notes: `本模块完成后：${module.outcome}` }, module);
  for (const activityId of module.activityRefs) {
    const activity = activityById.get(activityId);
    push('demo-step', activity.title, {
      activityId,
      command: activity.command,
      submission: activity.submission,
      evidence: activity.evidence,
      rubricId: activity.rubricId,
      notes: `先运行，再提交结构化证据。${activity.evidence.verification === 'mixed' ? '最终结论需要人工复核。' : '自动检查只负责确定性下限。'}`
    }, module, activity);
  }
  push('review', `${module.title} · 复盘`, { prompts: ['哪个信号真正改变了决策？', '哪个反例会让当前结论失效？', '下一次运行如何重放？'], notes: '工程、产品、验证三视角分别回答，不共用同一结论。' }, module);
}
push('review', '结业门槛', { completionPolicy: manifest.completionPolicy, notes: '12 个活动全部达标，三角色评审齐全，结业项目经人工签署后才能生成完成凭证。' });

const jobs = activities.activities.map((activity) => ({ ...activity.runtimeJob, activityId: activity.id, validator: activity.validator }));
const cards = manifest.modules.map((module) => ({
  id: `card-${module.id}`,
  title: module.title,
  summary: module.outcome,
  status: 'approved',
  sourceRefs: module.chapterRefs.map((locator) => ({ sourceId: 'source-ai-product-tutorial', locator })),
  governance: { status: 'approved', actionLabel: '已审核', hasRevision: false, approved: true, needsTeacherReview: false, needsRuntimeProof: false }
}));
const outlineSections = slides.map((slide, index) => ({
  id: `outline-${String(index + 1).padStart(2, '0')}`,
  title: slide.content.title,
  goals: slide.content.outcome ? [slide.content.outcome] : slide.content.bullets ?? slide.content.prompts ?? [manifest.promise],
  sourceCards: slide.content.sourceCards,
  runtimeFeasible: slide.runtimeJobs.length > 0,
  runtimeJobs: slide.runtimeJobs,
  durationMinutes: slide.kind === 'demo-step' ? 20 : 8
}));
const packageBody = {
  schema: 'course-package/v1',
  id: 'course-package-ai-product-loop',
  generatedAt: '2026-07-10T00:00:00.000Z',
  sourceMaterial: { schema: manifest.schema, id: manifest.id, version: manifest.version, contractHash: sha256(contract) },
  chain: ['requirement', 'recall', 'outline', 'gapTriage', 'slideAst', 'visualCatalog', 'runtime', 'learningPlan', 'assessment', 'publishGate'],
  requirement: { schema: 'course-requirement/v1', id: 'requirement-ai-product-loop', title: manifest.title, audience: manifest.audience.join('；'), duration: '2 days', goals: manifest.modules.map((module) => module.outcome), constraints: ['实操占比不低于 60%', '浏览器只提交受控任务', '结业项目需要人工复核'], source: 'AIProductTourial', status: 'parsed' },
  intent: { courseMode: 'two-day-workshop', requiredCoverage: ['Loop', 'Skills', 'MCP', 'evals', 'dataset', 'SDD'], runtimeEvidenceRequired: true, learningEvidenceRequired: true },
  recall: { queryCardCount: cards.length, cards },
  governance: { schema: 'course-card-governance/v1', cards: cards.length, approved: cards.length, needsTeacherReview: 0, needsRuntimeProof: 0, revised: 0, matchedReviews: cards.length, matchedRevisions: 0, statusCounts: { approved: cards.length }, readyForPublish: true, releaseBlockers: [] },
  outline: { id: 'outline-ai-product-loop', title: manifest.title, durationMinutes: manifest.durationMinutes, sections: outlineSections, gaps: [] },
  gapTriage: { schema: 'course-gap-triage/v1', coursePackage: 'course-package-ai-product-loop', policy: 'all required activities are explicit', items: [], summary: { total: 0, covered: 0, blocking: 0, statusCounts: {} } },
  slideAst: slides,
  visualCatalog: { schema: 'course-visual-catalog/v1', coursePackage: 'course-package-ai-product-loop', policy: visuals.policy, assets: visualAssets },
  runtimeManifest: { id: 'runtime-ai-product-loop', jobs, evidencePolicy: { required: true, acceptedReplayStatus: ['verified'], runtimeJobRefs: jobs.map((job) => job.id) } },
  learningPlan: { schema: 'learning-plan/v1', coursePackage: 'course-package-ai-product-loop', durationMinutes: manifest.durationMinutes, practiceMinutes: manifest.practiceMinutes, modules: manifest.modules, activities: activities.activities, rubrics: rubrics.rubrics, completionPolicy: manifest.completionPolicy, datasetCatalog: datasets },
  publishGate: { schemaValid: true, teacherApproved: false, visualApproved: true, runtimeEvidenceFresh: false, learningReady: true, releaseReady: false }
};
const output = { ...packageBody, hash: sha256(packageBody) };
const target = resolve(ROOT, 'outputs/html-ppt/ai-product-loop-course-package.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, target: 'outputs/html-ppt/ai-product-loop-course-package.json', slides: slides.length, activities: activities.activities.length, jobs: jobs.length, hash: output.hash }, null, 2));
