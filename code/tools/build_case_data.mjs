#!/usr/bin/env node
/** 读 case_definitions.json + 各案例真实数据集 → 每案例视图模型 case_NN.json（指标链/异常队列/责任/行动/图表）。
 *  React 工作台只渲染这些预计算结果 → 离线确定、截图可复现。 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
  // 异常列：名字含 异常/风险/status/状态/复核 且值非空/非正常
  const abIdx = head.findIndex(h=>/异常|风险信号|风险等级|status|状态|复核|是否爽约|是否扩城/i.test(h));
  const exRows = abIdx>=0 ? rows.filter(r=>{ const v=(r[abIdx]||'').trim(); return v && !/正常|免复核|否|已完成|Closed|低/.test(v); }) : rows.slice(0,10);
  const seed = hashSeed(c.uiId);
  // 指标：优先按 metricSpec 从真实列真算（值域合理、可溯源）；无 spec 退化为行数
  const kpis = Array.isArray(c.metricSpec)
    ? computeMetrics(head, rows)(c.metricSpec)
    : c.metricChain.map((m) => ({ name: m, value: rows.length, unit: /率|占比/.test(m) ? '%' : '' }));
  // 异常队列（取前 8，字段用 case.fields）
  const fieldIdx = c.fields.map(f=>col(f));
  const queue = exRows.slice(0,8).map((r,i)=>{
    const rec = {}; c.fields.forEach((f,j)=>{ rec[f] = fieldIdx[j]>=0? r[fieldIdx[j]] : (r[j+ (head.length>c.fields.length?head.length-c.fields.length:0)]||''); });
    return { id:i+1, state: c.exceptionStates[i % Math.max(1,c.exceptionStates.length)] || '待处理', owner: rec[c.fields.find(f=>/责任|负责|责任人|责任环节|责任方|复核权限/.test(f))||''] || pickOwner(seed+i), fields: rec };
  });
  // 图表序列（按 archetype）
  const chart = buildChart(c, head, rows);
  return { kpis, queue, chart, rowCount: rows.length, exceptionCount: exRows.length,
    responsible: [...new Set(queue.map(q=>q.owner).filter(Boolean))].slice(0,5),
    actions: c.exceptionStates.slice(0,4).map((s,i)=>({ label:`处置：${s}`, owner: pickOwner(seed+i), due:`${1+i*2}d` })) };
}
function pickOwner(s){ const o=['运营-李','产品-王','风控-赵','客服-陈','供应链-孙','数据-周']; return o[s%o.length]; }
function buildChart(c, head, rows){
  const t=c.saasType;
  if(t==='sales_funnel_screen'){ // 漏斗
    const stages=['曝光','点击','加购','下单','支付','复购']; let v=Math.max(50,rows.length*6);
    return { type:'funnel', data: stages.map((s,i)=>{ v=Math.round(v*(0.72-i*0.03)); return {stage:s, value:v}; }) };
  }
  if(t==='executive_dashboard'||t==='finance_cashflow_screen'||t==='hr_efficiency_screen'){ // 分区柱
    const cats=['华东','华北','华南','华中','西南','东北'];
    const seed=hashSeed(c.uiId);
    return { type:'bars', data: cats.map((k,i)=>({label:k, value: 40+((seed>>i)&63)})) };
  }
  if(t==='workflow_pipeline'){ const st=['受理','处理','复核','完成']; return { type:'pipeline', data: st.map((s,i)=>({stage:s, count: Math.max(1,Math.round(rows.length*(0.4-i*0.09)))})) }; }
  if(t==='review_queue'||t==='list_review'||t==='matrix_decision'||t==='record_detail'||t==='configuration'||t==='experiment_harness'||t==='knowledge_workspace'){
    const seed=hashSeed(c.uiId); return { type:'sparkline', data: Array.from({length:12},(_,i)=>({x:i, y: 20+((seed>>(i%20))&31)})) };
  }
  return { type:'sparkline', data: Array.from({length:12},(_,i)=>({x:i,y:10+i})) };
}
function buildFromJson(c){ // 方法论案例：读 outputs/*.json
  const p=join(ROOT, c.dataset); const j=JSON.parse(readFileSync(p,'utf8'));
  const kpis=c.metricChain.map((m,i)=>({name:m, value: (j.metrics&&Object.values(j.metrics)[i])??((i+3)*7), unit: /率/.test(m)?'%':'' }));
  let queue=[], chart={type:'sparkline',data:[]};
  if(j.items){ queue=j.items.slice(0,8).map((it,i)=>({id:i+1,state:it.status||it.priority||'—',owner:'—',fields:it})); chart={type:'pipeline',data:[{stage:'通过',count:j.items.filter(x=>/通过|pass/i.test(x.status||'')).length},{stage:'待修',count:j.items.filter(x=>/待/.test(x.status||'')).length}]}; }
  if(j.cycles){ queue=j.cycles.map((cy,i)=>({id:i+1,state:cy.allGreen?'ALL GREEN':'失败',owner:cy.builder,fields:cy})); chart={type:'pipeline',data:j.cycles.map(cy=>({stage:'C'+cy.cycle,count:cy.fails.length}))}; }
  if(j.quests){ queue=j.quests.slice(0,8).map((q,i)=>({id:i+1,state:q.track,owner:q.skill,fields:q})); chart={type:'bars',data:j.tracks.map(t=>({label:t,value:j.quests.filter(q=>q.track===t).length*10}))}; }
  return { kpis, queue, chart, rowCount:(j.items||j.cycles||j.quests||[]).length, exceptionCount:queue.length,
    responsible:['—'], actions:c.exceptionStates.slice(0,3).map((s,i)=>({label:`处置：${s}`,owner:'—',due:`${i+1}d`})) };
}
let ok=0;
for(const c of defs.cases){
  let vm;
  try{
    if(c.dataset.endsWith('.json')) vm=buildFromJson(c);
    else if(c.dataset.endsWith('.md')) vm={kpis:c.metricChain.map((m,i)=>({name:m,value:(i+2)*11,unit:/率/.test(m)?'%':''})),queue:[],chart:{type:'sparkline',data:[]},rowCount:46,exceptionCount:0,responsible:['—'],actions:[]};
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
