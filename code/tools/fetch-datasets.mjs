#!/usr/bin/env node
/**
 * 生成/下载课程数据集到 dataset/。为课堂可复现，默认确定性「教学合成」数据（种子固定，字段与结构
 * 对齐所引用的真实公开数据集，publicRef 见 case_definitions/ MANIFEST）；政务 311 尝试拉真实 Socrata。
 * 禁止把合成数据说成真实——MANIFEST 显式标注 real/synthetic。
 * 用法：node code/tools/fetch-datasets.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const DS = join(ROOT, 'dataset');
// 确定性 PRNG（mulberry32），禁用 Date/Math.random 以保证可复现
function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const pick=(r,arr)=>arr[Math.floor(r()*arr.length)];
const ri=(r,lo,hi)=>lo+Math.floor(r()*(hi-lo+1));
const rf=(r,lo,hi,d=2)=>Number((lo+r()*(hi-lo)).toFixed(d));
const csv=(rows)=>rows.map(row=>row.map(v=>{const s=String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')).join('\n')+'\n';
function writeCsv(rel, header, rows){ const p=join(DS,rel); mkdirSync(dirname(p),{recursive:true}); writeFileSync(p, csv([header,...rows])); return {rel,n:rows.length,p}; }
function writeJson(rel, obj){ const p=join(ROOT,rel); mkdirSync(dirname(p),{recursive:true}); writeFileSync(p, JSON.stringify(obj,null,2)); return {rel,p}; }
const iso=(base,days)=>new Date(base+days*86400000).toISOString().slice(0,10);
const BASE=Date.parse('2026-01-01T00:00:00Z'); // 固定基准，可复现
const results=[];
const T=(rel,label)=>({rel,label});

// ---- order_data.csv（对齐 UCI Online Retail 352；教学合成）----
{ const r=rng(101); const skus=Array.from({length:40},(_,i)=>['SKU'+String(1000+i),pick(r,['家居','数码','服饰','食品','美妆','母婴'])]);
  const regions=['华东','华北','华南','华中','西南','东北']; const rows=[];
  for(let i=0;i<1200;i++){ const [sku,cat]=pick(r,skus); const qty=ri(r,1,60); const price=rf(r,9,899); const region=pick(r,regions);
   const gross=rf(r,0.05,0.62); const stockDays=ri(r,1,180); const abn=r()<0.18; 
   rows.push(['ORD'+String(500000+i), iso(BASE,-ri(r,0,180)), sku, cat, region, qty, price, rf(r,qty*price,qty*price,2), gross, stockDays, abn?pick(r,['缺货','滞销','退货激增','毛利异常']):'', abn?pick(r,['仓配-王','运营-李','采购-赵']):'', abn?ri(r,4,72):'']); }
  results.push({...writeCsv('order_data.csv',['订单号','日期','SKU','品类','区域','数量','单价','金额','毛利率','库存天数','异常原因','责任人','处理时限h'],rows),label:'教学合成（对齐 UCI Online Retail 352）'}); }

// ---- sku.csv ----
{ const r=rng(102); const rows=[]; for(let i=0;i<300;i++){ const sold=ri(r,0,500); const stock=ri(r,0,900); const days=stock&&sold?Math.round(stock/Math.max(1,sold/30)):ri(r,1,240);
   rows.push(['SKU'+String(1000+i), pick(r,['家居','数码','服饰','食品','美妆','母婴']), stock, sold, days, rf(r,0.05,0.6), days>90?'滞销':(days>45?'预警':'正常')]); }
  results.push({...writeCsv('sku.csv',['SKU','品类','库存量','30天销量','库存天数','毛利率','状态'],rows),label:'教学合成（对齐 UCI Online Retail 352）'}); }

// ---- ex-17-RFM.csv（会员 RFM；对齐 Online Retail 衍生）----
{ const r=rng(117); const rows=[]; for(let i=0;i<800;i++){ const rec=ri(r,1,365),freq=ri(r,1,60),mon=rf(r,50,50000); const R=rec<30?5:rec<90?4:rec<180?3:rec<270?2:1; const F=freq>30?5:freq>15?4:freq>7?3:freq>3?2:1; const M=mon>20000?5:mon>10000?4:mon>4000?3:mon>1000?2:1;
   rows.push(['M'+String(10000+i), rec, freq, mon, R, F, M, ''+R+F+M, (R>=4&&F>=4)?'重要价值':(R>=4?'新客活跃':(F>=4?'重要保持':(R<=2?'流失预警':'一般')))]); }
  results.push({...writeCsv('ex-17-RFM.csv',['会员ID','最近购买天数R','购买频次F','消费金额M','R分','F分','M分','RFM','分层'],rows),label:'教学合成（对齐 UCI Online Retail 352 衍生 RFM）'}); }

// ---- product_cases/aicourse_*.csv ----
const gens={
 aicourse_hr_employees:[145,['员工号','部门','职级','司龄年','人效产出','绩效','流失风险'],r=>['E'+ri(r,10000,99999),pick(r,['研发','产品','销售','客服','供应链','职能']),pick(r,['P4','P5','P6','P7','M1','M2']),rf(r,0.2,12,1),rf(r,60,180),pick(r,['A','B+','B','C']),pick(r,['低','中','高'])]],
 aicourse_financial_transactions:[900,['交易号','账户','金额','渠道','时间','风险信号','风险等级','是否复核'],r=>{const amt=rf(r,10,80000);const hi=amt>30000||r()<0.12;return ['TX'+ri(r,1e6,9e6),'ACC'+ri(r,1000,9999),amt,pick(r,['网银','移动','POS','代扣']),iso(BASE,-ri(r,0,90)),hi?pick(r,['大额','异地','高频','夜间']):'正常',hi?pick(r,['高','中']):'低',hi?'待复核':'免复核'];}],
 aicourse_logistics_delivery:[700,['运单号','线路','城市','计划时效h','实际时效h','异常类型','是否扩城','责任方'],r=>{const plan=ri(r,12,72);const act=plan+ri(r,-6,48);const ab=act>plan+6;return ['WB'+ri(r,1e5,9e5),'L'+ri(r,1,40),pick(r,['北京','上海','广州','成都','杭州','武汉','西安','沈阳']),plan,act,ab?pick(r,['超时','破损','改派','缺车']):'',ab&&r()<0.3?'是':'否',ab?pick(r,['干线','网点','客服']):''];}],
 aicourse_healthcare_diabetes:[520,['就诊号','科室','预约时段','等待分钟','号源利用率','是否爽约','复核标记'],r=>['P'+ri(r,1e5,9e5),pick(r,['内分泌','心内','骨科','影像','检验']),pick(r,['08-10','10-12','14-16','16-18']),ri(r,5,180),rf(r,0.4,1.0),r()<0.14?'是':'否','需人工复核']],
 aicourse_ecommerce_orders:[1000,['订单号','SKU','状态','申请类型','时效天','异常','责任环节'],r=>{const ab=r()<0.22;return ['RO'+ri(r,1e6,9e6),'SKU'+ri(r,1000,1299),pick(r,['已下单','已发货','退货中','换货中','已完成']),pick(r,['退货','换货','仅退款']),ri(r,1,15),ab?pick(r,['超时未处理','拒收','物流异常','库存不符']):'',ab?pick(r,['仓储','客服','商家','物流']):''];}],
};
for(const [name,[n,header,gen]] of Object.entries(gens)){ const r=rng(name.length*7+1); const rows=Array.from({length:n},()=>gen(r));
  results.push({...writeCsv(`product_cases/${name}.csv`,header,rows),label:'教学合成'}); }

// ---- reference_data_analysis/*.csv ----
{ const r=rng(281); const rows=[]; for(let i=0;i<600;i++){ const amt=rf(r,1,50000); const fraud=r()<0.08; rows.push(['T'+ri(r,1e6,9e6),amt,pick(r,['线上','线下','跨境']),ri(r,0,23),fraud?pick(r,['盗刷','套现','异常商户']):'正常',fraud?'高':(amt>20000?'中':'低'),fraud||amt>20000?'待复核':'免复核',fraud?ri(r,1,5):'']); }
  results.push({...writeCsv('reference_data_analysis/28-creditcardfraud_sample.csv',['交易号','金额','渠道','小时','风险信号','风险等级','复核','命中规则数'],rows),label:'教学合成（对齐 UCI Bank/CreditCard）'}); }
{ const r=rng(302); const rows=[]; for(let i=0;i<800;i++){ const R=ri(r,1,400),F=ri(r,1,50),M=rf(r,300,120000); rows.push(['A'+ri(r,1e5,9e5),pick(r,['白金','金卡','银卡','普卡']),R,F,M,R<60&&F>20?'高价值':(R>200?'流失预警':'成长'),ri(r,0,200000)]); }
  results.push({...writeCsv('reference_data_analysis/2-air_data.csv',['会员号','卡等级','最近乘机天数','年飞行次数','年消费','分层','里程余额'],rows),label:'教学合成（航空会员 RFM）'}); }
{ const r=rng(318); const rows=[]; for(const ch of ['信息流A','信息流B','搜索','社交','联盟','视频']){ let imp=ri(r,50000,500000); const clk=Math.round(imp*rf(r,0.01,0.06)); const cvt=Math.round(clk*rf(r,0.02,0.15)); const cost=rf(r,clk*0.8,clk*3.5); rows.push([ch,imp,clk,cvt,cost,rf(r,cost/Math.max(1,cvt),cost/Math.max(1,cvt),2),rf(r,clk/imp,clk/imp,4),rf(r,cvt/Math.max(1,clk),cvt/Math.max(1,clk),4)]); }
  results.push({...writeCsv('reference_data_analysis/18-ad_performance.csv',['渠道','曝光','点击','转化','花费','CPA','CTR','CVR'],rows),label:'教学合成（广告投放漏斗）'}); }

// ---- pm_network_cases/nyc_311：尝试真实 Socrata，失败则合成 ----
let nyc311Real=false;
try{ const res=await fetch('https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=3000',{signal:AbortSignal.timeout(25000)});
  if(res.ok){ const j=await res.json(); const cols=['unique_key','created_date','closed_date','agency','complaint_type','descriptor','status','borough']; 
   const rows=j.map(o=>cols.map(c=>o[c]??'')); results.push({...writeCsv('pm_network_cases/nyc_311_service_requests_5000.csv',cols,rows),label:'真实（NYC 311 Socrata data.cityofnewyork.us）'}); nyc311Real=true; }
}catch{}
if(!nyc311Real){ const r=rng(311); const rows=[]; for(let i=0;i<1500;i++){ const open=r()<0.3; rows.push([ri(r,6e7,7e7),iso(BASE,-ri(r,0,120)),open?'':iso(BASE,-ri(r,0,60)),pick(r,['NYPD','DOT','DSNY','HPD','DEP']),pick(r,['Noise','Illegal Parking','Street Condition','Water System','Heat/Hot Water']),pick(r,['Loud Music','Blocked Driveway','Pothole','Leak','No Heat']),open?'Open':'Closed',pick(r,['MANHATTAN','BROOKLYN','QUEENS','BRONX','STATEN ISLAND'])]); }
  results.push({...writeCsv('pm_network_cases/nyc_311_service_requests_5000.csv',['unique_key','created_date','closed_date','agency','complaint_type','descriptor','status','borough'],rows),label:'教学合成（对齐 NYC 311，联网失败回退）'}); }

// ---- outputs/*.json（方法论案例输入产物）----
writeJson('outputs/05_harness/prototype_test_report.json',{meta:{case:36,note:'原型验收护栏样本'},checks:['字段','数据来源','状态','体验问题','风险项','修复优先级'],items:Array.from({length:12},(_,i)=>({field:['指标链','异常队列','责任对象','行动入口','数据来源','验收边界'][i%6],source:i%3?'dataset':'预计算',status:i%4?'通过':'待修',issue:i%4?'':'字段缺失',risk:i%5?'低':'中',priority:i%4?'P2':'P0'})),metrics:{字段覆盖率:0.83,状态异常数:3,体验问题完成率:0.75,风险项复核通过率:0.9}});
writeJson('outputs/11_loop_engineering/loop_report_sample.json',{meta:{case:37,rule:'同一失败连续两轮必须停止'},cycles:[{cycle:1,builder:'fix-a',checker:'run-tests',fails:['t3','t7'],regression:0,allGreen:false},{cycle:2,builder:'fix-b',checker:'run-tests',fails:['t7'],regression:0,allGreen:false},{cycle:3,builder:'fix-c',checker:'run-tests',fails:[],regression:0,allGreen:true}],result:'ALL GREEN'});
writeJson('outputs/10_knowledge_gamification/knowledge_quest_bank.json',{meta:{case:'15/43',note:'产业知识游戏化题库'},tracks:['需求管理','用户洞察','数据指标'],quests:Array.from({length:20},(_,i)=>({id:'Q'+(i+1),track:['需求管理','用户洞察','数据指标'][i%3],title:'关卡'+(i+1),skill:['problem-framing','metric-definition','journey-map'][i%3],points:10+(i%5)*5,pass:'答案回到数据或资料'}))});

// ---- MANIFEST ----
const man=['# 数据集清单（'+JSON.parse(readFileSync(join(ROOT,'code', 'tools','case_definitions.json'),'utf8')).projectName+'）','',
 '为课堂可复现，除标注「真实」外均为**确定性教学合成**数据（固定种子生成，字段与结构对齐所引用的真实公开数据集；publicRef 见各案例）。**不把合成数据说成真实。** 生成：`node code/tools/fetch-datasets.mjs`。','','| 文件 | 行/项 | 性质 | sha256 |','|---|---|---|---|'];
for(const x of results){ const buf=readFileSync(x.p); const h=createHash('sha256').update(buf).digest('hex').slice(0,16); man.push(`| ${x.rel} | ${x.n??'-'} | ${x.label} | ${h}… |`); }
man.push('','JSON 产物（方法论案例输入）：outputs/05_harness/prototype_test_report.json、outputs/11_loop_engineering/loop_report_sample.json、outputs/10_knowledge_gamification/knowledge_quest_bank.json、outputs/07_skills/pm_skills.md');
writeFileSync(join(DS,'MANIFEST.md'),man.join('\n')+'\n');
console.log('生成数据集', results.length, '个；NYC311 真实:', nyc311Real);
console.log(results.map(x=>x.rel+(x.n?`(${x.n})`:'')).join('  '));
