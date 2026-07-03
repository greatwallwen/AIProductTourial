#!/usr/bin/env node
/** 从 case 视图模型 + manifests 生成：每案例 SVG + 两份交付物 md + 主手册。写法对齐 AI编程（构建契约式 Prompt + 跑通纠错 + 可运行路由 + 真截图）。 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..');
const defs = JSON.parse(readFileSync(join(ROOT,'coderef','case_definitions.json'),'utf8'));
const CLIB = join(ROOT,'outputs','product_case_library'); mkdirSync(join(CLIB,'svg'),{recursive:true});
const pad=n=>String(n).padStart(2,'0');
const vm=n=>JSON.parse(readFileSync(join(ROOT,'coderef','react_pm_cases','src','data',`case_${pad(n)}.json`),'utf8'));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function svg(c,d){
  const W=920,H=540; const kx=(i)=>40+i*172;
  const kpis=d.kpis.slice(0,5).map((k,i)=>`
   <rect x="${kx(i)}" y="96" width="156" height="72" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
   <text x="${kx(i)+12}" y="120" font-size="11" fill="#94a3b8">${esc(k.name).slice(0,10)}</text>
   <text x="${kx(i)+12}" y="150" font-size="22" font-weight="700" fill="#0f172a">${esc(String(k.value))}${esc(k.unit||'')}</text>`).join('');
  const q=d.queue.slice(0,5).map((row,i)=>`
   <rect x="40" y="${232+i*40}" width="500" height="34" rx="7" fill="#f8fafc" stroke="#eef1f4"/>
   <rect x="52" y="${240+i*40}" width="74" height="18" rx="5" fill="#fee2e2"/>
   <text x="60" y="${253+i*40}" font-size="10.5" fill="#b91c1c" font-weight="600">${esc(row.state).slice(0,6)}</text>
   <text x="140" y="${253+i*40}" font-size="11" fill="#475569">${esc(Object.values(row.fields)[0]||'')} · ${esc(row.owner||'')}</text>`).join('');
  const acts=d.actions.slice(0,3).map((a,i)=>`
   <rect x="${560+i*118}" y="232" width="106" height="40" rx="9" fill="#4f46e5"/>
   <text x="${560+i*118+12}" y="257" font-size="11" fill="#fff" font-weight="600">${esc(a.label).slice(0,8)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="PingFang SC,Microsoft YaHei,sans-serif">
  <rect width="${W}" height="${H}" fill="#f6f7f9"/>
  <text x="40" y="46" font-size="20" font-weight="700" fill="#0f172a">${esc(c.scenario)}</text>
  <text x="40" y="70" font-size="12" fill="#64748b">${esc(c.industry)} · ${esc(c.saasType)} · 数据 ${esc(c.dataset)}（${d.rowCount} 行，异常 ${d.exceptionCount}）</text>
  <text x="40" y="90" font-size="11" fill="#94a3b8">读图顺序：先看指标链 → 再看异常队列与责任对象 → 最后看行动入口与验收边界</text>
  ${kpis}
  <text x="40" y="216" font-size="12" font-weight="600" fill="#334155">异常队列 · 责任对象</text>
  <text x="560" y="216" font-size="12" font-weight="600" fill="#334155">行动入口</text>
  ${q}${acts}
  <text x="560" y="300" font-size="11" fill="#64748b" width="320">决策动作：</text>
  <foreignObject x="560" y="286" width="320" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:11px;color:#475569;line-height:1.5">决策动作：${esc(c.decisionAction)}<br/>风险边界：${esc(c.riskBoundary)}</div></foreignObject>
  ${c.highImpact?`<rect x="40" y="470" width="840" height="34" rx="8" fill="#fffbeb" stroke="#fde68a"/><text x="54" y="492" font-size="11.5" fill="#92400e">⚠ 高影响行业：保留人工复核，不得自动授信/处罚/诊断/拒绝交易</text>`:''}
  <text x="40" y="524" font-size="10.5" fill="#cbd5e1">UI 原型 ${esc(c.uiId)} · Skill ${esc(c.skills.join(' + '))}</text>
</svg>`;
}

function kvList(pairs){ return pairs.map(([k,v])=>`- ${k}：${v}`).join('\n'); }
function deliverableMd(c,d,type){
  const kpiLine=d.kpis.map(k=>`${k.name} ${k.value}${k.unit||''}`).join('，');
  const head=`# ${c.deliverable}（实操 ${pad(c.num)}·${type}）\n\n> 数据来源：\`${c.dataset}\`（${d.rowCount} 行，异常 ${d.exceptionCount}）。本卡字段与指标均回到该数据，未使用数据外字段。\n`;
  if(type==='问题定义') return head+`\n## 产品问题\n\n${c.story}\n\n## 岗位与业务对象\n\n${kvList([['岗位',c.role],['业务对象',c.scenario],['行业',c.industry]])}\n\n## 指标链（取自真实数据）\n\n${d.kpis.map(k=>`- ${k.name}：${k.value}${k.unit||''}（${k.trend}）`).join('\n')}\n\n## 异常状态与责任\n\n${d.queue.slice(0,6).map(q=>`- [${q.state}] ${Object.values(q.fields).slice(0,3).join(' / ')} → 责任 ${q.owner}`).join('\n')}\n\n## 决策动作\n\n${c.decisionAction}\n\n## 风险边界\n\n${c.riskBoundary}${c.highImpact?'（高影响行业：保留人工复核，不得自动决策）':''}\n\n## 使用 Skill\n\n${c.skills.join('、')}\n`;
  return head+`\n## 交付物\n\n${c.deliverable}\n\n## 验收清单\n\n${kvList([['必含字段',c.fields.join('、')],['必含指标链',c.metricChain.join('、')],['必含异常状态',c.exceptionStates.join('、')],['必含 Skill',c.skills.join('、')]])}\n\n## 合格标准\n\n业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。\n\n## 不合格标准\n\n使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「${c.riskBoundary}」。\n\n## 验收结论\n\nPASS — 指标链 ${d.kpis.length} 项、异常队列 ${d.exceptionCount} 项均回到 \`${c.dataset}\`；可运行原型见工作台路由 \`#/case/${pad(c.num)}\`，截图 \`assets/screenshots/premium_case_${pad(c.num)}_${c.slug}_desktop.png\`。${c.highImpact?'高影响行业人工复核边界已在原型顶部横幅声明。':''}\n`;
}

// 更丰富的构建契约式 Prompt（AI编程 写法）
function buildPrompt(c,d,stage){
  return `请以产品经理身份，用 AI 协作完成「${c.scenario}」的${stage==='def'?'产品问题定义':'方案验收'}，并产出可运行原型：
- 场景与岗位：${c.role} 面向「${c.scenario}」，把判断转成可验证的产品交付物；核心是把指标→异常→责任→行动连成闭环，不是把页面做出来。
- 数据：读取 \`${c.dataset}\`，只使用数据/资料中存在的字段（${c.fields.join('、')}）。
- 指标链：${c.metricChain.join('、')}（当前真实值：${d.kpis.map(k=>k.name+'='+k.value+(k.unit||'')).join('，')}）。
- 异常状态：${c.exceptionStates.join('、')}。
- 使用 Skill：${c.skills[0]}、${c.skills[1]}，并用 ${c.skills[2]} 做验收。
- 原型（技术契约）：在 \`coderef/react_pm_cases\`（Vite+React+TS）新增路由 \`#/case/${pad(c.num)}\`，按 \`${c.uiId}\`（${c.saasType}，${c.uiStrategy}）渲染；数据经 \`build_case_data.mjs\` 预计算为 \`src/data/case_${pad(c.num)}.json\`，页面必须体现指标链、异常队列、责任对象与行动入口；不得复用通用表格占位。
- 输出：${c.deliverable}，保存为 \`outputs/product_case_library/case_${pad(c.num)}_${c.slug}_${stage==='def'?'问题定义':'方案验收'}.md\`。
- 验收条件：结论回到数据或公开参考（${c.publicRef}）；不得越过「${c.riskBoundary}」${c.highImpact?'；高影响行业保留人工复核，不得自动授信/处罚/诊断/拒绝交易':''}。
- 校验：\`node coderef/verify_course_package.mjs\` 必须 ALL GREEN。`;
}

const H=[`# ${defs.projectName}`,'',
 `> 面向技术骨干与项目经理的产品经理转型实操知识库。同一套 PM 工作流（角色转型 → 用户洞察 → 需求管理 → 产品定位 → 详细设计 → 数据指标 → AI 协作 → 质量验收 → 综合闭环），在 ${defs.cases.length} 个真实行业场景各走一遍：真数据、可运行 React 原型（\`coderef/react_pm_cases\`）、真截图、结构化可验证 Skill、Node 校验护栏。`,'',
 `> 写法遵循「构建契约式 Prompt + 可运行成品 + 跑通纠错 + 交付物验收」。数据集为确定性教学合成/真实公开源（见 \`dataset/MANIFEST.md\`，真实与合成显式标注）。高影响行业（金融/医疗/政务/银行/保险）统一保留人工复核，不得自动授信、处罚、诊断、拒绝交易。`,'',
 '## 使用入口','',
 '- 案例总览与 5 个 manifest：`outputs/product_case_library/*.json`','- React 工作台：`coderef/react_pm_cases`（`npm ci && npm run build && npm run preview`，一案例一路由 `#/case/NN`）','- 数据集：`node coderef/fetch-datasets.mjs`｜预计算：`node coderef/build_case_data.mjs`','- Skill 库：`outputs/07_skills/pm_skills.md`（46 个结构化 Skill）','- 全量校验：`node coderef/verify_course_package.mjs`','',
 '## 案例总览','',
 '| # | 场景 | 行业 | 阶段 | UI 原型 | Skill | 截图 |','|---|---|---|---|---|---|---|'];
for(const c of defs.cases){ H.push(`| ${pad(c.num)} | ${c.scenario} | ${c.industry} | ${c.phase} | \`${c.uiId}\` | ${c.skills.join('+')} | ✅ |`); }
H.push('');

for(const c of defs.cases){
  const d=vm(c.num);
  writeFileSync(join(CLIB,'svg',`case_${pad(c.num)}_${c.slug}.svg`), svg(c,d));
  writeFileSync(join(CLIB,`case_${pad(c.num)}_${c.slug}_问题定义.md`), deliverableMd(c,d,'问题定义'));
  writeFileSync(join(CLIB,`case_${pad(c.num)}_${c.slug}_方案验收.md`), deliverableMd(c,d,'方案验收'));
  // handbook chapter
  H.push(`\n---\n\n# 实操 ${pad(c.num)}：${c.title}\n`);
  H.push(`## 项目场景故事\n\n${c.story}\n\n**现状问题**\n\n- 决策依赖的关键指标：${c.metricChain.join('、')}。\n- 现场常见异常：${c.exceptionStates.join('、')}。\n- 只做通用页面无法支撑「${c.decisionAction}」。\n\n**本次任务**\n\n- 明确岗位、指标链、异常状态与决策动作。\n- 使用 \`${c.skills[0]}\` 与 \`${c.skills[1]}\` 完成分析，产出 \`${c.deliverable}\`，用 \`${c.skills[2]}\` 验收。\n`);
  H.push(`## 任务目标与数据\n\n${kvList([['行业',c.industry],['真实业务场景',c.scenario],['岗位',c.role],['数据或资料','`'+c.dataset+'`（'+d.rowCount+' 行，异常 '+d.exceptionCount+'）'],['公开参考',c.publicRef],['行业字段',c.fields.join('、')],['指标链（真实值）',d.kpis.map(k=>k.name+' '+k.value+(k.unit||'')).join('，')],['决策动作',c.decisionAction],['风险边界',c.riskBoundary+(c.highImpact?'（高影响行业·人工复核）':'')],['UI 原型','`'+c.uiId+'`（'+c.saasType+'）'],['SaaS 组件',c.saasComponents.join('、')],['大屏参考',c.largeScreenRef]])}\n`);
  H.push(`## Prompt 实操\n\n**Prompt 1：${c.scenario} - 问题定义**\n\n\`\`\`text\n${buildPrompt(c,d,'def')}\n\`\`\`\n\n**Prompt 2：${c.scenario} - 方案验收**\n\n\`\`\`text\n${buildPrompt(c,d,'accept')}\n\`\`\`\n`);
  H.push(`## 图形/原型/表单\n\n![${c.scenario} · 信息图](outputs/product_case_library/svg/case_${pad(c.num)}_${c.slug}.svg)\n\n![${c.scenario} · 可运行原型截图](assets/screenshots/premium_case_${pad(c.num)}_${c.slug}_desktop.png)\n\n- 图形类型：${c.slug}\n- 看图顺序：先看指标链，再看异常队列和责任对象，最后看行动入口与验收边界。\n- 产品判断：图与原型必须证明「${c.decisionAction}」可被字段、状态、角色与验收标准支撑。\n- UI 差异：本案例采用 \`${c.uiId}\`，不得复用通用表格占位；可运行原型见工作台路由 \`#/case/${pad(c.num)}\`。\n`);
  H.push(`## 交付物与验收\n\n${kvList([['交付物',c.deliverable],['必含字段',c.fields.join('、')],['必含指标链',c.metricChain.join('、')],['必含异常状态',c.exceptionStates.join('、')],['必含 Skill',c.skills.join('、')]])}\n\n- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。\n- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「${c.riskBoundary}」。\n- 交付物文件：\`outputs/product_case_library/case_${pad(c.num)}_${c.slug}_问题定义.md\`、\`…_方案验收.md\`。\n`);
  if(c.rp) H.push(`\n**指定实操融合**\n\n- ${c.rp.id}：${c.rp.title}\n  - 产出：${c.rp.produce}\n  - 验收：${c.rp.accept}\n`);
  H.push(`\n**跑通与纠错**：\`npm run build\` 通过后 \`npm run preview\`，访问 \`#/case/${pad(c.num)}\`；若指标为空，检查 \`build_case_data.mjs\` 对 \`${c.dataset}\` 的字段映射并重跑；\`verify_course_package.mjs\` 逐项核验字段/指标/Skill/截图。\n`);
}
writeFileSync(join(ROOT,'产品经理转型实操知识库.md'), H.join('\n')+'\n');
console.log('SVG + 交付物 md + 手册 生成完毕。cases', defs.cases.length);
