#!/usr/bin/env node
/**
 * 出版级文风检查器。扫描 docs 下全部 markdown，对照禁用/受限词表报告违例。
 *
 * 检查分两类：
 *   - 零容忍（ZERO）：命中即 ERROR。AI 套语、半角标点混中文、中英贴死、空预告句、"回答的问题"模板。
 *   - 限额（LIMIT）：全书或每千字超阈报 ERROR。招牌句式与强调标记密度。
 *
 * TIGHTEN 档位（0~4）控制限额严格度，供逐轮收紧：
 *   0 = 仅报告限额现状，不因限额失败（零容忍仍失败）
 *   1~4 = 限额逐档逼近出版目标，达标线见 LIMITS
 *
 * 代码块（``` 围栏）与行内代码（`...`）在 prose 检查中一律剥离。
 * 白名单：批判性"优雅/精巧"、ISO 术语"灵活性"由上下文豁免。
 *
 * 用法：node scripts/style-lint.mjs [--tighten=N] [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');

const argTighten = process.argv.find((a) => a.startsWith('--tighten='));
const TIGHTEN = argTighten ? Number(argTighten.split('=')[1]) : 0;
const JSON_OUT = process.argv.includes('--json');

// ---- 零容忍表 ----
const AI_CLICHES = [
  '本质上', '换句话说', '事实上', '实际上', '值得注意的是', '需要注意的是',
  '综上所述', '总的来说', '让我们', '我们来', '不难发现', '显而易见',
  '众所周知', '不言而喻', '毋庸置疑',
];

// ---- 限额目标：[全书上限 @tighten1..4]。加粗/破折号为正文每千字上限 ----
// 加粗/破折号只统计正文段落（表格单元格的术语加粗合理，已排除）。基线约 16 与 9/千字，
// 目标是正文强调去通胀到约每段一处，读感专业克制。
const LIMITS = {
  antithesis: [13, 11, 9, 8],    // 不是X，(而)是Z 对仗，全书
  emphaticThis: [13, 11, 9, 8],  // 这正是/这就是 收束，全书
  boldPerK: [13, 11, 10, 8],     // 正文加粗 每千字（基线约 16，目标 8，约减半）
  dashPerK: [8, 7, 6, 5.5],      // 正文破折号 每千字（基线约 9，目标 5.5）
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

/** 剥离代码块与行内代码，替换为等长空白以保持行号/偏移（prose 检查用） */
function stripCode(text) {
  let t = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
  t = t.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  return t;
}

/** 汉字数（用于每千字密度） */
function cjkCount(s) {
  return (s.match(/[一-龥]/g) || []).length;
}

const files = walk(DOCS);
const errors = [];
const warnings = [];
const report = { zero: {}, limit: {}, perFile: {} };

let totalCjk = 0;
let antithesis = 0;
let emphaticThis = 0;
let totalBold = 0;
let totalDash = 0;
const nextChapterByChapter = {};
const chapterSummaryLeads = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const prose = stripCode(raw);
  const rel = file.replace(ROOT + '/', '');
  // 正文文本：排除表格行（| …）与标题（#），表格单元格的术语加粗合理，不计入密度
  const bodyText = prose
    .split('\n')
    .filter((l) => !/^\s*\|/.test(l) && !/^\s*#/.test(l))
    .join('\n');
  const cjk = cjkCount(bodyText);
  totalCjk += cjk;

  const lines = prose.split('\n');
  const rawLines = raw.split('\n');

  // 零容忍：逐行
  lines.forEach((line, i) => {
    const ln = i + 1;
    for (const c of AI_CLICHES) {
      if (line.includes(c)) errors.push(`${rel}:${ln} [AI套语] "${c}"：${line.trim().slice(0, 40)}`);
    }
    // 半角逗号/句点混在中文之间
    const halfPunct = line.match(/[一-龥][,.][一-龥]/g);
    if (halfPunct) halfPunct.forEach((m) => errors.push(`${rel}:${ln} [半角标点] "${m}"`));
    // 中英贴死：中文紧跟 3+ 拉丁字母（英文技术名前应有空格）
    const glued = line.match(/[一-龥][A-Za-z]{3,}/g);
    if (glued) glued.forEach((m) => errors.push(`${rel}:${ln} [中英贴死] "${m}"（应加空格或译出）`));
    // 空预告句
    if (/^下一[节章].{0,15}。\s*$/.test(line.trim())) {
      errors.push(`${rel}:${ln} [空预告句] "${line.trim()}"`);
    }
    // "回答的问题"模板（tighten≥1 才强制，改写属文风打磨轮）
    if (TIGHTEN >= 1 && /\*\*回答的问题\*\*/.test(line)) {
      errors.push(`${rel}:${ln} [模板句] "回答的问题："应改陈述式小标题`);
    }
  });

  // 限额：全书累计（均基于正文段落，排除表格与标题）
  const at = (bodyText.match(/不是[^，,。！\n]{1,20}[，,]?(而)?是/g) || []).length;
  antithesis += at;
  const et = (bodyText.match(/这(正是|就是)/g) || []).length;
  emphaticThis += et;
  const bold = (bodyText.match(/\*\*[^*\n]+\*\*/g) || []).length;
  totalBold += bold;
  const dash = (bodyText.match(/——/g) || []).length;
  totalDash += dash;

  // 每章"下一章/下一节"枢纽句
  const chMatch = rel.match(/ch(\d\d)/);
  if (chMatch) {
    const ch = chMatch[1];
    const nx = (prose.match(/下一[章节]/g) || []).length;
    nextChapterByChapter[ch] = (nextChapterByChapter[ch] || 0) + nx;
  }

  // 四章"本章小结"引导语（取标题后首个非空段作为引导语）
  const summIdx = rawLines.findIndex((l) => /^##\s*本章小结/.test(l));
  if (summIdx >= 0) {
    chapterSummaryLeads.push({ rel, title: rawLines[summIdx].trim() });
  }

  report.perFile[rel] = { cjk, bold, dash, antithesis: at, emphaticThis: et,
    boldPerK: cjk ? +(bold / cjk * 1000).toFixed(1) : 0,
    dashPerK: cjk ? +(dash / cjk * 1000).toFixed(1) : 0 };
}

// 限额判定
const boldPerK = +(totalBold / totalCjk * 1000).toFixed(2);
const dashPerK = +(totalDash / totalCjk * 1000).toFixed(2);
report.limit = { antithesis, emphaticThis, boldPerK, dashPerK, totalCjk };

function checkLimit(name, value, targets, unit = '') {
  if (TIGHTEN < 1) { warnings.push(`[限额·报告] ${name} = ${value}${unit}（tighten 0，暂不失败）`); return; }
  const target = targets[Math.min(TIGHTEN, 4) - 1];
  if (value > target) errors.push(`[限额超标] ${name} = ${value}${unit} > 目标 ${target}${unit}（tighten ${TIGHTEN}）`);
  else warnings.push(`[限额·达标] ${name} = ${value}${unit} ≤ ${target}${unit}`);
}
checkLimit('对仗句(不是X是Z)', antithesis, LIMITS.antithesis, ' 处');
checkLimit('这正是/这就是', emphaticThis, LIMITS.emphaticThis, ' 处');
checkLimit('加粗密度', boldPerK, LIMITS.boldPerK, '/千字');
checkLimit('破折号密度', dashPerK, LIMITS.dashPerK, '/千字');

// 每章枢纽句 ≤1
for (const [ch, n] of Object.entries(nextChapterByChapter)) {
  if (n > 1 && TIGHTEN >= 1) errors.push(`[枢纽句超标] 第 ${ch} 章"下一章/节"出现 ${n} 次（每章 ≤1）`);
}

// 小结标题保持一致是导航优点，不检查；模板复读的真问题（"下一章"过渡句）由上面的枢纽句检查覆盖。
void chapterSummaryLeads;

if (JSON_OUT) {
  console.log(JSON.stringify({ TIGHTEN, report, errors, warnings }, null, 2));
} else {
  console.log(`文风检查（tighten=${TIGHTEN}，总字数 ${totalCjk.toLocaleString('zh-CN')}）`);
  console.log(`限额现状：对仗 ${antithesis}｜这正是 ${emphaticThis}｜加粗 ${boldPerK}/千字｜破折号 ${dashPerK}/千字`);
  if (warnings.length && TIGHTEN >= 1) console.log(`\n达标项 ${warnings.filter((w) => w.includes('达标')).length}`);
  if (errors.length) {
    console.log(`\n✖ ${errors.length} 处违例：`);
    for (const e of errors) console.log('  ' + e);
    process.exit(1);
  }
  console.log('\n✅ 文风检查通过');
}
