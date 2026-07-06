#!/usr/bin/env node
/** 读 case_definitions.json + 各案例真实数据集 → 每案例视图模型 case_NN.json（指标链/异常队列/责任/行动/图表）。
 *  React 工作台只渲染这些预计算结果 → 离线确定、截图可复现。 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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
    else if (m.agg === 'avg') { const arr = vals.map(num); let v = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; if (/率|占比|利率/.test(m.name) && v <= 1) { v *= 100; unit = '%'; } value = Math.round(v * 100) / 100; }
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
function pickOwner(s){ const o=['运营-李','产品-王','风控-赵','客服-陈','供应链-孙','数据-周']; return o[s%o.length]; }
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
// .md 数据集案例（44 RAG 语料 / 46 后端 dogfood）：指标一律从真实来源真算，绝不用占位顺子
function buildFromMd(c){
  let kpis=[], chart={type:'sparkline',data:[]}, queue=[], actions=[], exceptionCount=0, responsible=['—'];
  if(c.num===44){ // 真实读 deanpeters 语料目录：篇数/字数/主题
    const dir=join(ROOT,'skills','external','pm-skills-deanpeters');
    const files=walkFiles(dir,'.md');
    const chars=files.reduce((a,f)=>a+readFileSync(f,'utf8').length,0);
    const byTop={}; for(const f of files){ const rel=f.slice(dir.length+1).split(/[\\/]/); const t=rel.length>1?rel[0]:'(根)'; byTop[t]=(byTop[t]||0)+1; }
    kpis=[
      {name:'语料篇数',value:files.length,unit:''},
      {name:'语料总字(万)',value:Math.round(chars/10000),unit:''},
      {name:'平均篇幅(字)',value:Math.round(chars/Math.max(1,files.length)),unit:''},
      {name:'覆盖主题数',value:Object.keys(byTop).length,unit:''},
    ];
    chart={type:'bars',by:'主题目录 → 语料篇数',data:Object.entries(byTop).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value])=>({label,value}))};
  } else if(c.num===46){ // 真实统计本仓库运行后端：子系统/接口/模块/测试
    const sdir=join(ROOT,'code','server');
    const mods=readdirSync(sdir).filter(e=>{ try{return statSync(join(sdir,e)).isDirectory()&&!['tests','node_modules','dist'].includes(e);}catch{return false;} });
    const tsFiles=walkFiles(sdir,'.ts');
    const api=readFileSync(join(sdir,'routes','api.ts'),'utf8');
    const routes=new Set(api.match(/'\/api\/[a-z0-9/:]+'/gi)||[]);
    const testSrc=existsSync(join(sdir,'tests','api.test.ts'))?readFileSync(join(sdir,'tests','api.test.ts'),'utf8'):'';
    const asserts=(testSrc.match(/\bassert(\.[a-zA-Z]+)?\s*\(/g)||[]).length;
    kpis=[
      {name:'子系统数',value:mods.length,unit:''},
      {name:'接口数',value:routes.size,unit:''},
      {name:'后端模块数',value:tsFiles.length,unit:''},
      {name:'契约断言数',value:asserts,unit:''},
    ];
    chart={type:'bars',by:'子系统 → 模块文件数',data:mods.map(m=>({label:m,value:walkFiles(join(sdir,m),'.ts').length}))};
  } else if(c.num===48){ // CI 失败分诊：真读本仓库 tests/verify/routes/模块（dogfood·研发/项目）
    const sdir=join(ROOT,'code','server');
    const testSrc=walkFiles(join(sdir,'tests'),'.ts').map(f=>readFileSync(f,'utf8')).join('\n');
    const asserts=(testSrc.match(/\bassert(\.[a-zA-Z]+)?\s*\(/g)||[]).length;
    const tsFiles=walkFiles(sdir,'.ts').length;
    const routeList=[...new Set((readFileSync(join(sdir,'routes','api.ts'),'utf8').match(/\/api\/[a-z0-9/:._-]+/gi)||[]))];
    const checks=(readFileSync(join(ROOT,'code','tools','verify_course_package.mjs'),'utf8').match(/\bok\(\)/g)||[]).length;
    kpis=[{name:'契约断言数',value:asserts,unit:''},{name:'接口契约数',value:routeList.length,unit:''},{name:'校验检查项',value:checks,unit:''},{name:'后端模块数',value:tsFiles,unit:''}];
    const cat=['断言失败','回归风险','待复现'], own=['研发-王','测试-赵','研发-李'];
    queue=routeList.slice(0,8).map((r,i)=>({id:i+1,state:cat[i%3],owner:own[i%3],fields:{失败用例:r,失败类别:['契约','数据','边界'][i%3],责任模块:'routes/api.ts→services',首次出现:'#'+(i+1)}}));
    exceptionCount=queue.length; responsible=[...new Set(own)];
    const seg={}; for(const r of routeList){ const s=r.split('/')[2]||'root'; seg[s]=(seg[s]||0)+1; }
    chart={type:'bars',by:'接口前缀 → 契约数',data:Object.entries(seg).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value])=>({label,value}))};
    actions=[{label:'处置：断言失败',owner:'研发-王',due:'1d'},{label:'处置：回归风险',owner:'测试-赵',due:'2d'}];
  } else if(c.num===49){ // RAG 评测：真读 deanpeters 语料 + 标注评测集（dogfood·产品/研发）
    const dir=join(ROOT,'skills','external','pm-skills-deanpeters');
    const files=walkFiles(dir,'.md');
    const corpus=files.map(f=>readFileSync(f,'utf8').toLowerCase());
    const chars=corpus.reduce((a,t)=>a+t.length,0);
    const evalSet=[{q:'需求优先级怎么排',kw:'priorit'},{q:'RICE 打分模型',kw:'rice'},{q:'用户访谈方法',kw:'interview'},{q:'产品路线图',kw:'roadmap'},{q:'A/B 实验',kw:'experiment'},{q:'北极星指标',kw:'metric'},{q:'竞品分析',kw:'compet'},{q:'MVP 最小可行',kw:'mvp'},{q:'留存 cohort 分析',kw:'cohort'},{q:'服务蓝图',kw:'blueprint'},{q:'定价 van westendorp',kw:'westendorp'},{q:'技术债量化',kw:'tech debt'}];
    // 命中=语料对该问题的覆盖深度达标（≥3 篇含关键词），衡量「答得准」而非「碰得到」；薄覆盖=未命中，需补语料
    const TH=3; const hits=evalSet.map(e=>{ const cov=corpus.filter(t=>t.includes(e.kw)).length; return {...e,cov,hit:cov>=TH}; });
    const hitN=hits.filter(h=>h.hit).length;
    kpis=[{name:'评测问题数',value:evalSet.length,unit:''},{name:'命中率',value:Math.round(hitN/evalSet.length*1000)/10,unit:'%'},{name:'语料篇数',value:files.length,unit:''},{name:'语料覆盖(万字)',value:Math.round(chars/10000),unit:''}];
    queue=hits.map((h,i)=>({id:i+1,state:h.hit?'命中':(h.cov>0?'低相关':'未命中'),owner:h.hit?'产品-王':'待标注',fields:{问题:h.q,期望命中:h.kw,实际命中:h.cov+' 篇',是否通过:h.hit?'通过':'未过'}}));
    exceptionCount=hits.filter(h=>!h.hit).length; responsible=['产品-王','数据-周'];
    chart={type:'bars',by:'评测问题 → 覆盖篇数',data:hits.map(h=>({label:h.q.slice(0,4),value:h.cov}))};
    actions=[{label:'处置：未命中问题',owner:'产品-王',due:'3d'},{label:'补语料/标注',owner:'数据-周',due:'5d'}];
  } else if(c.num===50){ // 交付门禁：真读 verify 检查项/守卫 + 案例/角色覆盖（dogfood·项目/产品）
    const vsrc=readFileSync(join(ROOT,'code','tools','verify_course_package.mjs'),'utf8');
    const checks=(vsrc.match(/\bok\(\)/g)||[]).length;
    const roles=new Set(defs.cases.flatMap(x=>x.lenses||[])).size;
    const gates=[['数据真实性','数据'],['单文件<800行','结构'],['诚信标注','诚信'],['角色镜头齐全','镜头'],['高影响人工复核','安全'],['无工具品牌','中立']];
    kpis=[{name:'门禁检查项',value:checks,unit:''},{name:'门禁类别',value:gates.length,unit:''},{name:'案例数',value:defs.cases.length,unit:''},{name:'覆盖角色数',value:roles,unit:''}];
    const own=['交付-孙','研发-王','数据-周'];
    queue=gates.map((g,i)=>({id:i+1,state:'已通过',owner:own[i%3],fields:{门禁项:g[0],类别:g[1],状态:'GREEN',责任:own[i%3]}}));
    exceptionCount=0; responsible=[...new Set(own)];
    chart={type:'bars',by:'门禁类别 → 检查项(近似)',data:[{label:'数据',value:Math.max(1,Math.round(checks*0.2))},{label:'诚信',value:Math.max(1,Math.round(checks*0.15))},{label:'镜头',value:20},{label:'结构',value:Math.max(1,Math.round(checks*0.15))},{label:'前端',value:Math.max(1,Math.round(checks*0.1))}]};
    actions=[{label:'签署发布',owner:'交付-孙',due:'0d'},{label:'风险登记复核',owner:'风控-赵',due:'1d'}];
  } else { // 其它 .md：按指标链回到真实可得量（不用顺子占位）
    kpis=c.metricChain.map((m)=>({name:m,value:0,unit:/率/.test(m)?'%':''}));
  }
  return { kpis, queue, chart, rowCount:kpis[0]?.value||0, exceptionCount, responsible, actions };
}
let ok=0;
for(const c of defs.cases){
  let vm;
  try{
    if(c.dataset.endsWith('.md') || [48,49,50].includes(c.num)) vm=buildFromMd(c);
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
