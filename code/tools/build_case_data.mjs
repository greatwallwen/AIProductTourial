#!/usr/bin/env node
/** 读 case_definitions.json + 各案例真实数据集 → 每案例视图模型 case_NN.json（指标链/异常队列/责任/行动/图表）。
 *  React 工作台只渲染这些预计算结果 → 离线确定、截图可复现。 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const OUTDIR = join(ROOT, 'code', 'data');
mkdirSync(OUTDIR, { recursive: true });
const defs = JSON.parse(readFileSync(join(ROOT, 'code', 'tools', 'case_definitions.json'), 'utf8'));
function parseCsv(p){ const t=readFileSync(p,'utf8').trim().split('\n'); const head=splitLine(t[0]); return { head, rows:t.slice(1).map(splitLine) }; }
function splitLine(l){ const out=[]; let cur='',q=false; for(const c of l){ if(c==='"'){q=!q;} else if(c===','&&!q){out.push(cur);cur='';} else cur+=c; } out.push(cur); return out; }
const num=(v)=>{ const n=parseFloat(String(v).replace(/[^\d.\-]/g,'')); return isFinite(n)?n:0; };
const hashSeed=(s)=>{ let h=2166136261; for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619); return (h>>>0); };

// 真实列驱动的指标计算（替代启发式）：按 metricSpec 从数据真算，值域合理、可溯源
function computeMetrics(head, rows) {
  const idx = (c) => head.findIndex(h => h === c);
  return (spec) => spec.map(m => {
    const ci = m.col ? idx(m.col) : -1; const vals = ci >= 0 ? rows.map(r => r[ci]) : [];
    let value = 0, unit = '';
    if (m.agg === 'count') value = rows.length;
    else if (m.agg === 'distinct') value = new Set(vals.filter(v => v !== '' && v != null)).size;
    else if (m.agg === 'sum') value = Math.round(vals.reduce((a, v) => a + num(v), 0));
    else if (m.agg === 'max') value = Math.round(Math.max(0, ...vals.map(num)));
    else if (m.agg === 'avg') { const arr = vals.filter((v) => v !== '' && v != null).map(num).filter(Number.isFinite); /* v17 P0-5：空值不计入均值（曾把空串当 0 → 4.46h 假象，真值≈40h） */ let v = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; if (/率|占比|利率/.test(m.name) && v <= 1) { v *= 100; unit = '%'; } value = Math.round(v * 100) / 100; }
    else if (m.agg === 'rate') { const re = m.arg ? new RegExp(m.arg) : null; const hit = vals.filter(v => { const s = (v == null ? '' : v).toString().trim(); return re ? re.test(s) : (s !== ''); }).length; value = Math.round(hit / Math.max(1, rows.length) * 1000) / 10; unit = '%'; }
    else if (m.agg === 'rateGte') { const hit = vals.filter(v => num(v) >= m.arg).length; value = Math.round(hit / Math.max(1, rows.length) * 1000) / 10; unit = '%'; }
    else if (m.agg === 'rateLte') { const hit = vals.filter(v => num(v) <= m.arg).length; value = Math.round(hit / Math.max(1, rows.length) * 1000) / 10; unit = '%'; }
    if (!unit && /率|占比/.test(m.name)) unit = '%';
    return { name: m.name, value, unit };
  });
}
function buildFromCsv(c){
  const p = join(ROOT, c.dataset);
  const { head, rows } = parseCsv(p);
  const col = (name)=>head.findIndex(h=>h===name);
  // 异常列：优先 case_definitions 显式 abColumn，否则按名字启发（异常/风险/status/状态/复核…）。
  // 解析出的列名会写进 case_NN.json（下方 return 的 abColumn），前端 live 复算「只按此列」——单一真源，消除 build 与 server 两套正则的分叉。
  const abIdx = c.abColumn ? col(c.abColumn) : head.findIndex(h=>/异常|风险信号|风险等级|status|状态|复核|是否爽约|是否扩城/i.test(h));
  const exRows = abIdx>=0 ? rows.filter(r=>{ const v=(r[abIdx]||'').trim(); return v && !/正常|免复核|否|已完成|Closed|低/.test(v); }) : rows.slice(0,10);
  const seed = hashSeed(c.uiId);
  // 指标：优先按 metricSpec 从真实列真算（值域合理、可溯源）；无 spec 退化为行数
  const kpis = Array.isArray(c.metricSpec)
    ? computeMetrics(head, rows)(c.metricSpec)
    : c.metricChain.map((m) => ({ name: m, value: rows.length, unit: /率|占比/.test(m) ? '%' : '' }));
  // 异常队列（诚信映射）：字段只填真实存在的列（缺则 —，绝不错位）；状态取真实异常列；责任取真实责任列（无则空，不伪造）
  const fieldIdx = c.fields.map(f=>col(f));
  const respName = c.fields.find(f=>/责任|负责|责任人|责任环节|责任方|复核权限/.test(f));
  const respIdx = respName!==undefined ? col(respName) : head.findIndex(h=>/责任人|责任方|责任环节|经办|负责人/.test(h));
  const queue = exRows.slice(0,8).map((r,i)=>{
    const rec = {}; c.fields.forEach((f,j)=>{ rec[f] = fieldIdx[j]>=0 ? r[fieldIdx[j]] : '—'; });
    const state = (abIdx>=0 && (r[abIdx]||'').trim()) ? String(r[abIdx]).trim() : (c.exceptionStates[i % Math.max(1,c.exceptionStates.length)] || '待处理');
    const owner = respIdx>=0 ? (r[respIdx]||'') : '';
    return { id:i+1, state, owner, fields: rec };
  });
  // 图表序列（按 archetype）
  const chart = buildChart(c, head, rows);
  return { kpis, queue, chart, rowCount: rows.length, exceptionCount: exRows.length, abColumn: abIdx>=0?head[abIdx]:null,
    responsible: [...new Set(queue.map(q=>q.owner).filter(Boolean))].slice(0,5),
    actions: c.exceptionStates.slice(0,4).map((s,i)=>({ label:`处置：${s}`, owner: pickOwner(seed+i), due:`${1+i*2}d` })) };
}
function pickOwner(s){ const o=['运营-李','产品-王','风控-赵','客服-陈','供应链-孙','数据-周']; return o[s%o.length]+'（演示角色）'; } // v17 P1-11：无真实责任源时明示虚构
// 数据驱动图表（替代 saasType 哈希噪声）：按真实分类列聚合真实数值列，图表反映本案例真实数据故事
function buildChart(c, head, rows){
  const idxOf=(re)=>head.findIndex(h=>re.test(h));
  const sumCol=idxOf(/金额|消费|花费|曝光|点击|转化|里程/);
  const avgCol=idxOf(/等待|时效|利用率|毛利率|人效|频次|评分/);
  const catCol=idxOf(/品类|区域|渠道|科室|城市|分层|卡等级|状态|部门|线路|申请类型|异常类型|风险等级/);
  if(catCol>=0 && sumCol>=0){ // 按分类求和真实数值
    const agg={}; for(const r of rows){ const k=(r[catCol]||'—').toString().slice(0,6); agg[k]=(agg[k]||0)+num(r[sumCol]); }
    return { type:'bars', by:`${head[catCol]} → Σ${head[sumCol]}`, data:Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value])=>({label,value:Math.round(value)})) };
  }
  if(catCol>=0 && avgCol>=0){ // 按分类求真实均值
    const s={},n={}; for(const r of rows){ const k=(r[catCol]||'—').toString().slice(0,6); s[k]=(s[k]||0)+num(r[avgCol]); n[k]=(n[k]||0)+1; }
    return { type:'bars', by:`${head[catCol]} → 均${head[avgCol]}`, data:Object.keys(s).slice(0,7).map(k=>({label:k,value:Math.round(s[k]/n[k]*10)/10})) };
  }
  const distCol = sumCol>=0?sumCol:avgCol;
  if(distCol>=0){ // 数值真实分布直方
    const vals=rows.map(r=>num(r[distCol])).filter(v=>v>0); const mx=Math.max(...vals,1),bins=6,h=Array(bins).fill(0);
    for(const v of vals) h[Math.min(bins-1,Math.floor(v/mx*bins))]++;
    return { type:'bars', by:`${head[distCol]} 分布`, data:h.map((v,i)=>({label:`${Math.round(mx/bins*i)}+`,value:v})) };
  }
  return { type:'bars', by:'记录数', data:[{label:'总量',value:rows.length}] };
}
// 递归收集某扩展名文件（供 .md 案例真算：语料/后端 dogfood）
function walkFiles(dir, ext){
  const out=[];
  for(const e of readdirSync(dir)){ const p=join(dir,e);
    if(e==='node_modules'||e==='dist') continue;
    if(statSync(p).isDirectory()) out.push(...walkFiles(p,ext));
    else if(e.endsWith(ext)) out.push(p);
  }
  return out;
}
// .md 数据集案例（04 RAG 语料 / 06 后端 dogfood）：指标一律从真实来源真算，绝不用占位顺子
function buildFromMd(c){
  let kpis=[], chart={type:'sparkline',data:[]}, queue=[], actions=[], exceptionCount=0, responsible=['—'], deps=[], cycles=0, game=null, nacos=null, ds=null;
  if(c.num===4){ // 真实读 CMRC2018 中文语料目录（v22）：篇数/字数/篇幅分布 + 金标问答数
    const dir=join(ROOT,'dataset','rag','corpus');
    const files=walkFiles(dir,'.md');
    const lens=files.map(f=>readFileSync(f,'utf8').length);
    const chars=lens.reduce((a,x)=>a+x,0);
    const goldN=JSON.parse(readFileSync(join(ROOT,'dataset','rag','gold.json'),'utf8')).length;
    const buckets={}; for(const L of lens){ const b=Math.min(8,Math.floor(L/150)); const key=`${b*150}+字`; buckets[key]=(buckets[key]||0)+1; }
    kpis=[
      {name:'语料篇数',value:files.length,unit:''},
      {name:'语料总字(万)',value:Math.round(chars/10000),unit:''},
      {name:'平均篇幅(字)',value:Math.round(chars/Math.max(1,files.length)),unit:''},
      {name:'金标问答数',value:goldN,unit:''},
    ];
    chart={type:'bars',by:'语料篇幅(字)分布 → 篇数',data:Object.entries(buckets).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([label,value])=>({label,value}))};
  } else if(c.num===6){ // 真实统计本仓库运行后端：子系统/接口/模块/测试
    const sdir=join(ROOT,'code','server');
    const mods=readdirSync(sdir).filter(e=>{ try{return statSync(join(sdir,e)).isDirectory()&&!['tests','node_modules','dist'].includes(e);}catch{return false;} });
    const tsFiles=walkFiles(sdir,'.ts');
    const api=readFileSync(join(sdir,'routes','api.ts'),'utf8');
    const routes=new Set(api.match(/'\/api\/[a-z0-9/:]+'/gi)||[]);
    // 真实依赖：扫每个子系统 .ts 的 import → 子系统间依赖边 + 循环依赖检测（适应度函数/架构守护）
    const edgeSet=new Set();
    for(const sub of mods){ for(const f of walkFiles(join(sdir,sub),'.ts')){ const imps=readFileSync(f,'utf8').match(/from\s+'[^']+'/g)||[]; for(const imp of imps) for(const other of mods) if(other!==sub && new RegExp(`/${other}/|\\.\\./${other}\\b`).test(imp)) edgeSet.add(sub+'>'+other); } }
    deps=[...edgeSet].map(e=>{const [from,to]=e.split('>');return {from,to};});
    cycles=deps.filter(e=>edgeSet.has(e.to+'>'+e.from)).length/2;
    kpis=[
      {name:'子系统数',value:mods.length,unit:''},
      {name:'接口契约数',value:routes.size,unit:''},
      {name:'依赖边数',value:deps.length,unit:''},
      {name:'循环依赖',value:cycles,unit:''},
    ];
    chart={type:'bars',by:'子系统 → 依赖出度',data:mods.map(m=>({label:m,value:deps.filter(e=>e.from===m).length}))};
  } else if(c.num===7){ // RAG 评测（v17-A）：金标单源 eval_gold.json，裁判真调 store.ts search()（hit@3）——经 eval_harness --json
    const ev=JSON.parse(execSync('node code/tools/eval_harness.mjs --json',{cwd:ROOT,encoding:'utf8'}));
    const files=walkFiles(join(ROOT,'dataset','rag','corpus'),'.md');
    kpis=[{name:'评测问题数',value:ev.results.length,unit:''},{name:'命中率',value:ev.score,unit:'%'},{name:'覆盖达标数',value:ev.results.filter(r=>r.cov>=3).length,unit:''},{name:'语料篇数',value:files.length,unit:''}];
    queue=ev.results.map((r,i)=>({id:i+1,state:r.hit?'命中@1':(r.cov>=3?'未命中（覆盖足、检索未召回）':'未命中'),owner:r.hit?'产品-王（演示角色）':'待标注',fields:{问题:r.q,'重排第1':r.top3[0]?r.top3[0].slice(0,24):'—',覆盖篇数:r.cov,是否通过:r.hit?'通过':'未过'}}));
    exceptionCount=ev.results.filter(r=>!r.hit).length; responsible=['产品-王（演示角色）','数据-周（演示角色）'];
    chart={type:'bars',by:'评测问题 → 覆盖篇数',data:ev.results.map(r=>({label:r.q.slice(0,10),value:r.cov}))};
    actions=[{label:'处置：检索未召回问题（调权重/切词）',owner:'研发-王（演示角色）',due:'3d'},{label:'补语料/标注',owner:'数据-周（演示角色）',due:'5d'}];
  } else if(c.num===8){ // SDD 系统建造走查：真读 rules/docs/case_definitions/verify/arch 图（dogfood·研发/项目/产品）
    const ruleFiles=walkFiles(join(ROOT,'rules'),'.md');
    const clauses=ruleFiles.reduce((a,f)=>a+(readFileSync(f,'utf8').match(/^\s*(?:[-*·]|\d+[.、)])\s/gm)||[]).length,0);
    const subs=readdirSync(join(ROOT,'code','server')).filter(e=>{try{return statSync(join(ROOT,'code','server',e)).isDirectory()&&!['tests','node_modules','dist'].includes(e);}catch{return false;}}).length;
    const checks=(readFileSync(join(ROOT,'code','tools','verify_course_package.mjs'),'utf8').match(/\bok\(\)/g)||[]).length;
    const archSvgs=walkFiles(join(ROOT,'outputs','product_case_library','svg'),'.svg').filter(f=>/fig_(sdd|c4|ddd|deployment|req)/.test(f)).length;
    const docFiles=walkFiles(join(ROOT,'docs','_source'),'.md').length;
    const serverTs=walkFiles(join(ROOT,'code','server'),'.ts').length;
    kpis=[{name:'宪法条款',value:clauses,unit:''},{name:'子系统数',value:subs,unit:''},{name:'门禁检查项',value:checks,unit:''},{name:'架构图数',value:archSvgs,unit:''}];
    const steps=[
      ['① 宪法','rules/ai-dev-constraints.md','已立','DRY / 单文件<800 / 安全红线',ruleFiles.length],
      ['② 规格','docs/_source/*.md','已写','章节规格 + 案例定义',docFiles],
      ['③ 澄清','（人在关口）','人工','消除意图债务(§2.9)',1],
      ['④ 架构设计','arch SVG + §3 ADR','已画','C4 / DDD / ADR-001',archSvgs],
      ['⑤ 任务分解','case_definitions.json','已分',`${defs.cases.length} 案例/子任务`,defs.cases.length],
      ['⑥ 实现','code/ 全栈','已建','Fastify + React 真服务',serverTs],
      ['⑦ 门禁','verify + eval_harness + 双测','实时（见页内活体门禁）','运行时真跑，红绿由 /api/gates 报告',3],
      ['⑧ 演进','演进触发表','待触发','按信号切 PG / pgvector',3],
    ];
    const own=['研发-王（演示角色）','产品-王（演示角色）','项目-孙（演示角色）']; // v17 P1-11
    queue=steps.map((s,i)=>({id:i+1,state:s[2],owner:own[i%3],fields:{步骤:s[0],工件:s[1],状态:s[2],产出:s[3]}}));
    exceptionCount=0; responsible=[...new Set(own)];
    chart={type:'bars',by:'SDD 八步 → 工件/文件数',data:steps.map(s=>({label:s[0].replace(/[①-⑧] /,''),value:s[4]}))};
    actions=[{label:'补澄清 / 消歧',owner:'产品-王',due:'1d'},{label:'跑门禁三绿',owner:'研发-王',due:'0d'}];
    // v24：真实研发效能对照（apache/dolphinscheduler 近 100 CI/PR），把「门禁/返工」从 dogfood 自身扩到一个真实大项目
    { const dv=JSON.parse(readFileSync(join(ROOT,'dataset','real','dolphinscheduler_devops.json'),'utf8'));
      ds={ source:dv.source, license:dv.license, ci:dv.ci, prMergeRate:dv.prMergeRate, prByType:dv.prByType, prTotal:dv.prs.length }; }
  } else if(c.num===9){ // 事件总线（v18-P3 dogfood）：真实 git 提交流 + 当前门禁规模——事件溯源最小标本
    const log=execSync("git log --pretty=format:'%h|%ct|%s' -n 400",{cwd:ROOT,encoding:'utf8'}).split('\n').map(l=>l.replace(/^'|'$/g,'')).filter(Boolean).map(l=>{const [h,t,...m]=l.split('|');return {h,t:Number(t)*1000,msg:m.join('|')};});
    const checks=(readFileSync(join(ROOT,'code','tools','verify_course_package.mjs'),'utf8').match(/\bok\(\)/g)||[]).length;
    const days=Math.max(1,Math.round((log[0].t-log[log.length-1].t)/86400000));
    const ver=(m)=>{const x=m.match(/^(v\d+)/i);return x?x[1].toLowerCase():(/(phase|收尾|清理)/i.test(m)?'phase':'其他');};
    const byVer={}; for(const e of log){const v=ver(e.msg); byVer[v]=(byVer[v]||0)+1;}
    const vers=Object.entries(byVer).sort((a,b)=>b[1]-a[1]);
    kpis=[{name:'事件总数',value:log.length,unit:''},{name:'时间跨度天',value:days,unit:''},{name:'迭代版本数',value:vers.filter(([k])=>/^v\d/.test(k)).length,unit:''},{name:'门禁检查项',value:checks,unit:''}];
    queue=log.slice(0,8).map((e,i)=>({id:i+1,state:ver(e.msg).startsWith('v')?'迭代事件':'工程事件',owner:'git（真实）',fields:{哈希:e.h,时间:new Date(e.t).toISOString().slice(0,16).replace('T',' '),标题:e.msg.slice(0,42)}}));
    exceptionCount=log.filter(e=>/revert|回退|回滚/i.test(e.msg)).length; responsible=['git（真实事件源）'];
    chart={type:'bars',by:'迭代版本 → 提交事件数（真实聚合）',data:vers.slice(0,8).map(([label,value])=>({label,value}))};
    actions=[{label:'复盘：回退/异常提交',owner:'平台工程（演示角色）',due:'2d'}];
    // v24：大型国产开源项目对照（alibaba/nacos 真实事件流），与本仓库 dogfood 小事件流并置=事件溯源大小对照
    { const nx=JSON.parse(readFileSync(join(ROOT,'dataset','real','nacos_git_events.json'),'utf8'));
      nacos={ source:nx.source, license:nx.license, eventCount:nx.eventCount, spanDays:nx.spanDays, mergeCount:nx.mergeCount, byType:nx.byType,
        selfEventCount:log.length, sample:nx.events.slice(0,6).map(e=>({h:e.h,subject:e.subject.slice(0,44),parents:e.parents.length})) }; }
  } else { // 其它 .md：按指标链回到真实可得量（不用顺子占位）
    kpis=c.metricChain.map((m)=>({name:m,value:0,unit:/率/.test(m)?'%':''}));
  }
  return { kpis, queue, chart, rowCount:kpis[0]?.value||0, exceptionCount, responsible, actions, deps, cycles, game, nacos, ds };
}
let ok=0;
for(const c of defs.cases){
  let vm;
  try{
    if(!c.dataset.endsWith('.csv') || [7,8,9].includes(c.num)) vm=buildFromMd(c); // 非 CSV（目录/描述串）一律走 md/dogfood 路径
    else vm=buildFromCsv(c);
  }catch(e){ console.error('FAIL case',c.num,e.message); continue; }
  const out={ num:c.num, title:c.title, industry:c.industry, role:c.role, saasType:c.saasType, uiId:c.uiId, slug:c.slug,
    uiStrategy:c.uiStrategy, largeScreenRef:c.largeScreenRef, components:c.saasComponents, skills:c.skills, rp:c.rp,
    highImpact:c.highImpact, riskBoundary:c.riskBoundary, decisionAction:c.decisionAction, dataset:c.dataset,
    metricChainNames:c.metricChain, exceptionStates:c.exceptionStates, fields:c.fields, design:c.design, demonstrates:c.demonstrates, systemLayer:c.systemLayer, systemStage:c.systemStage, theoryOp:c.theoryOp, difficulty:c.difficulty, tldr:c.tldr, insight:c.insight, pitfall:c.pitfall, ...vm };
  writeFileSync(join(OUTDIR, `case_${String(c.num).padStart(2,'0')}.json`), JSON.stringify(out,null,1));
  ok++;
}
// 索引
writeFileSync(join(OUTDIR,'index.json'), JSON.stringify({ projectName:defs.projectName, cases: defs.cases.map(c=>({num:c.num,title:c.title,slug:c.slug,uiId:c.uiId,saasType:c.saasType,industry:c.industry,phase:c.phase,highImpact:c.highImpact,rp:c.rp?.id||null,systemLayer:c.systemLayer,systemStage:c.systemStage,difficulty:c.difficulty,tldr:c.tldr})) },null,1));
console.log('build_case_data:', ok, '/', defs.cases.length, 'cases → src/data/');
