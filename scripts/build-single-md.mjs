#!/usr/bin/env node
/**
 * 把 docs/ 下的全部章节源文件按阅读顺序合并为根目录单文件教程。
 * - 图片相对路径改写为根相对路径（docs/chXX/images/*.svg）
 * - 章节间 .md 链接改写为文内锚点
 * 用法：node scripts/build-single-md.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, '信息化产品系统架构设计实操教程.md');

const FILES = [
  'docs/ch01-methodology/01-why-product-view.md',
  'docs/ch01-methodology/02-process-overview.md',
  'docs/ch01-methodology/03-steps-1-4.md',
  'docs/ch01-methodology/04-steps-5-8.md',
  'docs/ch01-methodology/05-occams-razor.md',
  'docs/ch02-gov-approval/01-business-and-constraints.md',
  'docs/ch02-gov-approval/02-architecture-decisions.md',
  'docs/ch02-gov-approval/03-data-api-security.md',
  'docs/ch02-gov-approval/04-deployment-and-code.md',
  'docs/ch02-gov-approval/adr/adr-001-modular-monolith.md',
  'docs/ch02-gov-approval/adr/adr-002-config-driven-items.md',
  'docs/ch02-gov-approval/adr/adr-003-state-machine.md',
  'docs/ch02-gov-approval/adr/adr-004-xinchuang-db.md',
  'docs/ch03-contract-mgmt/01-business-and-constraints.md',
  'docs/ch03-contract-mgmt/02-architecture-decisions.md',
  'docs/ch03-contract-mgmt/03-data-api-security.md',
  'docs/ch03-contract-mgmt/04-deployment-and-code.md',
  'docs/ch03-contract-mgmt/adr/adr-001-table-driven-routing.md',
  'docs/ch03-contract-mgmt/adr/adr-002-rbac-datascope.md',
  'docs/ch03-contract-mgmt/adr/adr-003-org-sync.md',
  'docs/ch03-contract-mgmt/adr/adr-004-anticorruption-adapters.md',
  'docs/ch03-contract-mgmt/adr/adr-005-pg-search.md',
  'docs/ch04-device-monitor/01-business-and-constraints.md',
  'docs/ch04-device-monitor/02-architecture-decisions.md',
  'docs/ch04-device-monitor/03-data-api-security.md',
  'docs/ch04-device-monitor/04-deployment-and-code.md',
  'docs/ch04-device-monitor/adr/adr-001-mqtt-ingestion.md',
  'docs/ch04-device-monitor/adr/adr-002-timescaledb.md',
  'docs/ch04-device-monitor/adr/adr-003-process-split.md',
  'docs/ch04-device-monitor/adr/adr-004-inline-alerting.md',
  'docs/ch04-device-monitor/adr/adr-005-sse-dashboard.md',
  'docs/ch05-saas-ticket/01-business-and-constraints.md',
  'docs/ch05-saas-ticket/02-architecture-decisions.md',
  'docs/ch05-saas-ticket/03-data-api-security.md',
  'docs/ch05-saas-ticket/04-deployment-and-code.md',
  'docs/ch05-saas-ticket/adr/adr-001-pool-tenancy.md',
  'docs/ch05-saas-ticket/adr/adr-002-defense-in-depth.md',
  'docs/ch05-saas-ticket/adr/adr-003-tenant-identity.md',
  'docs/ch05-saas-ticket/adr/adr-004-billing-state-machine.md',
  'docs/ch05-saas-ticket/adr/adr-005-bullmq-redis.md',
  'docs/ch06-comparison.md',
  'docs/appendix/a-templates.md',
  'docs/appendix/b-svg-style-guide.md',
  'docs/appendix/c-project-conventions.md',
];

/** GitHub 风格锚点（保留中日韩文字，去标点，空格转连字符） */
function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

const entries = FILES.map((file) => {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const m = text.match(/^#\s+(.+)$/m);
  const heading = m ? m[1].trim() : file;
  return { file, text, heading, slug: slugify(heading) };
});

const anchorByFile = new Map(entries.map((e) => [e.file, `#${e.slug}`]));

/**
 * 小节令牌 → 锚点索引（M7）。扫描所有标题，抓出以 A.1 / B.4 / C.5 / 1.3 / 2.4 等
 * 小节编号开头的标题，映射到其 slug 锚点，供正文里"附录 A.1""1.3 节"这类纯文本引用自动加链接。
 */
const tokenAnchor = new Map();
for (const e of entries) {
  for (const line of e.text.split('\n')) {
    const m = line.match(/^#{1,6}\s+((?:[ABC]\.\d+)|(?:\d\.\d+))\b/);
    if (m && !tokenAnchor.has(m[1])) tokenAnchor.set(m[1], `#${slugify(line.replace(/^#{1,6}\s+/, ''))}`);
  }
}

/** 把正文里的小节引用（代码块外、非已有链接）自动加成锚点链接。 */
function autolinkRefs(text) {
  const segs = text.split(/(```[\s\S]*?```|`[^`\n]*`|!?\[[^\]]*\]\([^)]*\))/g);
  return segs
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // 代码块/行内代码/已有链接原样保留
      let s = seg;
      s = s.replace(/附录\s*([ABC]\.\d+)/g, (all, tok) =>
        tokenAnchor.has(tok) ? `[附录 ${tok}](${tokenAnchor.get(tok)})` : all
      );
      s = s.replace(/(?<![0-9.])(\d\.\d+)\s*节/g, (all, tok) =>
        tokenAnchor.has(tok) ? `[${tok} 节](${tokenAnchor.get(tok)})` : all
      );
      return s;
    })
    .join('');
}

function rewriteLinks(entry) {
  const dir = dirname(entry.file);
  return entry.text.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (all, bang, label, target) => {
    if (/^(https?:|#|mailto:)/.test(target)) return all;
    const [path] = target.split('#');
    const norm = relative(ROOT, resolve(join(ROOT, dir), path)).replaceAll('\\', '/');
    if (bang) return `![${label}](${norm})`; // 图片 → 根相对路径
    if (anchorByFile.has(norm)) return `[${label}](${anchorByFile.get(norm)})`; // 章节 → 锚点
    return `[${label}](${norm})`; // 工程目录等 → 根相对路径
  });
}

const parts = [];
parts.push('# 信息化产品系统架构设计实操教程');
parts.push('');
parts.push('> 面向有经验开发者的实操教程：同一套八步架构设计流程，在政务、企业管理、行业业务、SaaS 四个领域各完整走一遍。');
parts.push('> 全部图形为可直接渲染的 SVG（含 SMIL 动画，浏览器中查看）；全部代码与数据来自可运行的示例工程（`code/`，运行 `bash scripts/verify-all.sh` 验证）。');
parts.push('> 本文件由 `node scripts/build-single-md.mjs` 从 `docs/` 章节源文件合并生成，请勿直接编辑。');
parts.push('');
parts.push('## 目录');
parts.push('');
for (const e of entries) {
  const indent = e.file.includes('/adr/') ? '  ' : '';
  parts.push(`${indent}- [${e.heading}](#${e.slug})`);
}
for (const e of entries) {
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push(autolinkRefs(rewriteLinks(e)));
}

let output = parts.join('\n');

// M6：--embed 把 SVG/PNG 内联为 data URI，产出自包含单文件（脱离仓库也能看图），另存不覆盖默认版
const EMBED = process.argv.includes('--embed');
let outFile = OUT;
let embedded = 0;
if (EMBED) {
  output = output.replace(/!\[([^\]]*)\]\((docs\/[^)]+\.svg)\)/g, (all, label, path) => {
    try {
      const svg = readFileSync(join(ROOT, path), 'utf8');
      embedded++;
      return `![${label}](data:image/svg+xml;utf8,${encodeURIComponent(svg)})`;
    } catch {
      return all;
    }
  });
  // PNG（页面截图）内联为 base64（二进制，不能用 encodeURIComponent）
  output = output.replace(/!\[([^\]]*)\]\((docs\/[^)]+\.png)\)/g, (all, label, path) => {
    try {
      const buf = readFileSync(join(ROOT, path));
      embedded++;
      return `![${label}](data:image/png;base64,${buf.toString('base64')})`;
    } catch {
      return all;
    }
  });
  outFile = OUT.replace(/\.md$/, '.embedded.md');
}

writeFileSync(outFile, output);
console.log(`已生成：${relative(ROOT, outFile)}`);
console.log(`章节数：${entries.length}，总字符数：${output.length.toLocaleString('zh-CN')}` + (EMBED ? `，内联图 ${embedded} 张` : ''));
