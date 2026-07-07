#!/usr/bin/env node
/** Skill 扫描器（Nacos skill-scanner 的可运行本地实例，§7 dogfood）：扫 skills/ 的六槽完整性 + 提示注入/危险指令/元数据缺失。
 *  「不过则不发布」：发现问题 exit 1，纳入三绿门禁。用法：node code/tools/skill_lint.mjs [--json] */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const F = [];
const add = (sev, cat, where, msg) => F.push({ sev, cat, where, msg });

// 提示注入 / 越权 / 泄露 / 危险指令模式（skill-scanner 核心：这些不该出现在受信 Skill 里）
const INJECTION = [
  [/忽略(以上|上面|之前)(的)?(所有)?(指令|规则|说明)/i, '提示注入：要求忽略既有指令'],
  [/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|rules)/i, '提示注入：ignore previous instructions'],
  [/disregard\s+(the\s+)?(system|previous)/i, '提示注入：disregard system'],
  [/(exfiltrate|外泄|上传).{0,20}(密钥|token|secret|凭证|credential)/i, '数据泄露：外传密钥/凭证'],
  [/(curl|wget)\s+[^\n|]*\|\s*(sh|bash|node|python)/i, '危险指令：管道执行远程脚本'],
  [/rm\s+-rf\s+[~/]/i, '危险指令：rm -rf 根/家目录'],
  [/(cat|发送|上传)[^\n]{0,30}(\.env|id_rsa|\.aws\/credentials|\.ssh\/)/i, '数据泄露：读取/外传敏感文件'],
];
// pm_skills.md 六槽（构建型/验收·守护型技能的可验证结构）
const SLOTS = ['触发条件', '输入', '澄清问题', 'PRD 片段', '验收标准', '复用范围'];

function scanFile(rel, text) {
  for (const [re, msg] of INJECTION) if (re.test(text)) add('HIGH', 'injection', rel, msg);
}
// 1) 逐 Skill 文件扫注入/危险指令
const skillFiles = ['skills/pm_skills.md', ...readdirSync(join(ROOT, 'skills', 'loop_engineering')).filter((f) => f.endsWith('.md')).map((f) => 'skills/loop_engineering/' + f)];
for (const f of skillFiles) scanFile(f, rd(f));
// 2) pm_skills.md 六槽完整性 + 元数据
{
  const src = rd('skills/pm_skills.md');
  const blocks = src.split(/\n## /).slice(1); // 每个 ## skill 块
  for (const b of blocks) {
    const name = b.split('\n')[0].trim();
    const missing = SLOTS.filter((s) => !new RegExp('- ' + s + '：').test(b) && !new RegExp('- ' + s.replace(' ', '') + '：').test(b));
    if (missing.length) add('MED', 'slots', `pm_skills.md#${name}`, `六槽缺失：${missing.join('、')}`);
    if (!/类型：(构建型|验收·守护型|构建型 \/ 验收·守护型)/.test(b)) add('LOW', 'meta', `pm_skills.md#${name}`, '缺「类型」元数据');
  }
}

// 输出
const rank = { HIGH: 0, MED: 1, LOW: 2 };
F.sort((a, b) => rank[a.sev] - rank[b.sev]);
const counts = F.reduce((o, f) => ((o[f.sev] = (o[f.sev] || 0) + 1), o), {});
const scanned = skillFiles.length + rd('skills/pm_skills.md').split(/\n## /).length - 1;
if (process.argv.includes('--json')) console.log(JSON.stringify({ counts, findings: F }, null, 2));
else {
  console.log(`\nskill_lint · 扫描 ${skillFiles.length} 文件 / ${rd('skills/pm_skills.md').split(/\n## /).length - 1} 个 pm_skill`);
  if (!F.length) console.log('  ✅ 通过：无注入/危险指令，六槽/元数据齐全（可发布）');
  else { for (const f of F.slice(0, 30)) console.log(`  [${f.sev}] ${f.cat} · ${f.where} — ${f.msg}`); console.log(`  共 ${F.length} 项：HIGH ${counts.HIGH || 0} · MED ${counts.MED || 0} · LOW ${counts.LOW || 0}`); }
}
// 门禁：HIGH（注入/危险）必阻断；MED（六槽）也阻断（受信 Skill 必须结构完整）；LOW 仅告警
const block = (counts.HIGH || 0) + (counts.MED || 0);
if (block > 0) { console.error(`\n✗ skill_lint 未通过（${block} 项 HIGH/MED）——「不过则不发布」`); process.exit(1); }
process.exit(0);
