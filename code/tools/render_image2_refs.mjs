#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
let sharp;
for (const candidate of [process.env.SHARP_PATH, 'sharp'].filter(Boolean)) {
  try { sharp = require(candidate); break; } catch { /* try next */ }
}
if (!sharp) {
  console.error('sharp is required: install it or set SHARP_PATH to its entry file');
  process.exit(1);
}

const sourceDir = join(ROOT, 'outputs', 'product_case_library', 'svg');
const targetDir = join(ROOT, 'work', 'image2-refs');
mkdirSync(targetDir, { recursive: true });
const items = [];
for (const file of readdirSync(sourceDir).filter((name) => name.endsWith('.svg')).sort()) {
  const source = join(sourceDir, file);
  const target = join(targetDir, file.replace(/\.svg$/i, '.png'));
  await sharp(source, { density: 180 })
    .resize(1600, 900, { fit: 'contain', background: '#f8fafc' })
    .flatten({ background: '#f8fafc' })
    .png()
    .toFile(target);
  items.push({ source: `outputs/product_case_library/svg/${file}`, target: `work/image2-refs/${basename(target)}`, sourceHash: `sha256:${createHash('sha256').update(readFileSync(source)).digest('hex')}` });
}
writeFileSync(join(targetDir, 'manifest.json'), `${JSON.stringify({ schema: 'image2-reference-render/v1', items }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, rendered: items.length, target: 'work/image2-refs' }, null, 2));
