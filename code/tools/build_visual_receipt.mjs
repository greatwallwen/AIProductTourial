#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const visuals = JSON.parse(readFileSync(join(ROOT, 'course', 'visuals.json'), 'utf8'));
const sha = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
const rel = (path) => relative(ROOT, path).replace(/\\/g, '/');

function pngInfo(path) {
  const body = readFileSync(path);
  if (body.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`not png: ${rel(path)}`);
  const width = body.readUInt32BE(16);
  const height = body.readUInt32BE(20);
  return { width, height, aspectRatio: Math.round(width / height * 1000) / 1000, bytes: body.length };
}

const items = [];
for (const sourceRef of visuals.ownedDiagrams) {
  const source = resolve(ROOT, sourceRef);
  const target = resolve(ROOT, `assets/course/image2/diagrams/${sourceRef.split('/').at(-1).replace(/\.svg$/i, '.png')}`);
  if (!existsSync(source) || !existsSync(target)) throw new Error(`visual pair missing: ${sourceRef}`);
  items.push({ id: sourceRef.split('/').at(-1).replace(/\.svg$/i, ''), kind: 'diagram', generatedBy: 'gpt-image-2', source: sourceRef, sourceHash: sha(source), target: rel(target), targetHash: sha(target), ...pngInfo(target) });
}
for (const replacement of visuals.image2Replacements) {
  const source = resolve(ROOT, replacement.source);
  const target = resolve(ROOT, replacement.target);
  if (!existsSync(source) || !existsSync(target)) throw new Error(`visual pair missing: ${replacement.target}`);
  items.push({ id: replacement.target.split('/').at(-1).replace(/\.png$/i, ''), kind: 'concept-illustration', generatedBy: 'gpt-image-2', caption: replacement.caption, source: replacement.source, sourceHash: sha(source), target: replacement.target, targetHash: sha(target), ...pngInfo(target) });
}

const screenshots = visuals.runtimeScreenshots.map((pathRef) => {
  const path = resolve(ROOT, pathRef);
  const sidecar = path.replace(/\.png$/i, '.json');
  if (!existsSync(path) || !existsSync(sidecar)) throw new Error(`screenshot or sidecar missing: ${pathRef}`);
  return { id: pathRef.split('/').at(-1).replace(/\.png$/i, ''), kind: 'runtime-screenshot', generatedBy: 'playwright-live-page', target: pathRef, targetHash: sha(path), sidecar: rel(sidecar), sidecarHash: sha(sidecar), ...pngInfo(path) };
});

const bookRoot = resolve(ROOT, 'AI时代研发产品项目一体化知识库');
const markdown = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.md')) markdown.push(path);
  }
};
walk(bookRoot);
const publishedText = markdown.map((path) => readFileSync(path, 'utf8')).join('\n');
const blockers = [];
if (/assets\/vendor\/aiagent\//.test(publishedText)) blockers.push('published book still references vendor aiagent graphics');
if (/outputs\/product_case_library\/svg\//.test(publishedText)) blockers.push('published book still references pre-image2 SVG figures');
for (const item of items) {
  if (item.bytes < 50000) blockers.push(`${item.target} is suspiciously small`);
  if (item.width < 1200 || item.height < 700) blockers.push(`${item.target} is below course resolution`);
  if (item.aspectRatio < 1.4 || item.aspectRatio > 1.85) blockers.push(`${item.target} has unexpected aspect ratio ${item.aspectRatio}`);
}
const report = {
  schema: 'course-visual-receipt/v1',
  courseId: visuals.courseId,
  policy: visuals.policy,
  summary: { image2: items.length, diagrams: items.filter((item) => item.kind === 'diagram').length, conceptIllustrations: items.filter((item) => item.kind === 'concept-illustration').length, runtimeScreenshots: screenshots.length, blockers: blockers.length },
  items,
  screenshots,
  excludedFromImage2: visuals.excludedFromImage2,
  blockers,
  ok: blockers.length === 0
};
const manifestPath = resolve(ROOT, 'assets/course/image2/manifest.json');
const receiptPath = resolve(ROOT, 'outputs/course_visual_receipt.json');
mkdirSync(dirname(manifestPath), { recursive: true });
mkdirSync(dirname(receiptPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(receiptPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: report.ok, ...report.summary, manifest: rel(manifestPath), receipt: rel(receiptPath) }, null, 2));
if (!report.ok) process.exit(1);
