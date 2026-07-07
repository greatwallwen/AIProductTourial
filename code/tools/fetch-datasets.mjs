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
const results=[];

// ---- 读仓内固定真实快照（dataset/real/*，构建期零联网、确定性；来源/许可/sha 见 MANIFEST）----
const REAL=join(DS,'real');
function splitLine(l){ const o=[]; let c='',q=false; for(const ch of l){ if(ch==='"'){q=!q;} else if(ch===','&&!q){o.push(c);c='';} else c+=ch; } o.push(c); return o; }
function readReal(name){ const t=readFileSync(join(REAL,name),'utf8').trim().split('\n'); const head=splitLine(t[0]); return { head, rows:t.slice(1).map(splitLine), col:(n)=>head.indexOf(n) }; }
// 商品描述 → 派生类目（关键词优先匹配；对真实描述的合理归类，销量/营收仍为真实）
const CAT_RULES=[['灯饰',/LIGHT|LANTERN|CANDLE|T-?LIGHT|\bLAMP/],['厨餐',/KITCHEN|MUG|BOWL|\bCUP\b|\bJAR|PLATE|CUTLERY|BAKING|TEAPOT|\bJUG|BOTTLE|SPOON|CAKE|\bTIN\b/],['家饰',/HEART|HANGING|FRAME|CLOCK|DECORATION|CUSHION|DOORMAT|MIRROR|DRAWER|\bHOOK|ORNAMENT|HOLDER/],['文具',/\bPEN\b|PENCIL|PAPER|\bCARD|NOTEBOOK|CHALK|STICKER|ERASER|RUBBER|NAPKIN|\bTAPE/],['箱包',/\bBAG|LUNCH BOX|SHOPPER|PURSE|WALLET|\bCASE\b/],['玩具',/\bTOY|\bGAME|\bPLAY|\bDOLL|JIGSAW|SKITTLE|SPACEBOY|SOLDIER|BINGO/],['节庆',/CHRISTMAS|EASTER|BIRTHDAY|VALENTINE|HALLOWEEN|PARTY|ADVENT|XMAS/],['园艺',/GARDEN|FLOWER|PLANT|WATERING|\bHERB|\bSEED/],['织品',/TOWEL|APRON|RIBBON|FELT|KNIT|SCARF|GLOVE|DOILY/]];
const toCat=(desc)=>{ const d=(desc||'').toUpperCase(); for(const [c,re] of CAT_RULES) if(re.test(d)) return c; return '其他'; };
// 国家 → 中文译名（非虚构，仅本地化显示）
const CN_COUNTRY={ 'United Kingdom':'英国','EIRE':'爱尔兰','Netherlands':'荷兰','Germany':'德国','France':'法国','Australia':'澳大利亚','Sweden':'瑞典','Spain':'西班牙','Switzerland':'瑞士','Portugal':'葡萄牙','Belgium':'比利时','Channel Islands':'海峡群岛','Italy':'意大利','Finland':'芬兰','Norway':'挪威','Austria':'奥地利','Denmark':'丹麦','Japan':'日本','Poland':'波兰','USA':'美国','Cyprus':'塞浦路斯','Greece':'希腊','Israel':'以色列','Iceland':'冰岛','Lithuania':'立陶宛','Malta':'马耳他','Canada':'加拿大','Brazil':'巴西','RSA':'南非','Bahrain':'巴林','Lebanon':'黎巴嫩','Singapore':'新加坡','Czech Republic':'捷克','United Arab Emirates':'阿联酋','Saudi Arabia':'沙特','European Community':'其他欧盟','Unspecified':'未标注' };
const cn=(c)=>CN_COUNTRY[c]||c;

// ---- order_data.csv：真实基座 UCI Online Retail II（CC BY 4.0）+ 标注合成叠加 ----
// 真实列：订单号/日期/SKU/品类(派生自真实描述)/区域(真实国家译名)/数量/单价/金额/异常原因(真实退货信号)
// 教学合成叠加（源无成本/库存/责任数据，确定性种子、MANIFEST 与正文显式标注）：毛利率/库存天数/责任人/处理时限h
{ const s=readReal('retail_online_retail_ii.csv'); const r=rng(1001);
  const [iInv,iSku,iDesc,iQty,iDate,iPrice,iCty]=['Invoice','StockCode','Description','Quantity','InvoiceDate','Price','Country'].map(s.col);
  const marginBase={'家饰':0.55,'灯饰':0.5,'文具':0.5,'节庆':0.5,'玩具':0.46,'织品':0.44,'厨餐':0.42,'园艺':0.4,'箱包':0.38,'其他':0.36};
  const owners=['仓配-王','运营-李','采购-赵','客服-陈'];
  const rows=s.rows.map(row=>{ const qty=Number(row[iQty])||0, price=Number(row[iPrice])||0; const isReturn=(row[iInv]||'').startsWith('C')||qty<0;
    const cat=toCat(row[iDesc]); const region=cn(row[iCty]);
    const gross=Math.max(0.05,Math.min(0.7,(marginBase[cat]??0.4)+(r()-0.5)*0.12)); const stockDays=ri(r,1,180); // 教学合成叠加
    return [row[iInv], row[iDate], row[iSku], cat, region, qty, price, Number((qty*price).toFixed(2)), Number(gross.toFixed(2)), stockDays,
      isReturn?'退货':'', isReturn?pick(r,owners):'', isReturn?ri(r,4,72):'']; });
  results.push({...writeCsv('order_data.csv',['订单号','日期','SKU','品类','区域','数量','单价','金额','毛利率','库存天数','异常原因','责任人','处理时限h'],rows),label:'真实基座 UCI Online Retail II（CC BY 4.0）+ 标注合成叠加(毛利率/库存天数/责任人/处理时限)'}); }

// 注：原 sku.csv / ex-17-RFM.csv / aicourse_hr_employees / aicourse_ecommerce_orders / aicourse_financial_transactions 已移除——均为无案例引用的孤儿合成集。

// ---- reference_data_analysis/28-credit_default_sample.csv：真实基座 UCI Default of Credit Card Clients（CC BY 4.0，台湾信用卡客户）----
// 全部由真实字段派生：账单金额(BILL_AMT1)、额度档(按真实 LIMIT_BAL 分档)、最近逾期月数与风险等级(按真实逐月还款状态 PAY_* 与违约标记 Y)、命中规则数。无合成叠加。
{ const s=readReal('finance_uci_default_credit.csv');
  const [iId,iLim,iB1,iY]=['ID','LIMIT_BAL','BILL_AMT1','default payment next month'].map(s.col);
  const payIdx=['PAY_0','PAY_2','PAY_3','PAY_4','PAY_5','PAY_6'].map(s.col);
  const rows=s.rows.map(row=>{ const lim=Number(row[iLim])||0, bill=Math.abs(Number(row[iB1])||0), def=row[iY]==='1';
    const pays=payIdx.map(i=>Number(row[i])||0); const delinq=pays.filter(v=>v>=1).length; const maxPay=Math.max(0,...pays);
    const tier=lim<50000?'低额度':lim<150000?'中额度':'高额度';
    const level=(def||maxPay>=2)?'高':((delinq>=1||bill>lim)?'中':'低');
    const sig=def?'确认违约':maxPay>=2?'连续逾期':delinq>=1?'首次逾期':bill>lim?'超额度用信':'正常';
    const rules=(def?1:0)+(maxPay>=2?1:0)+(delinq>=1?1:0)+(bill>lim?1:0)+(bill>0.8*lim?1:0);
    const review=(level==='高'||level==='中')?'待复核':'免复核';
    return ['TX'+row[iId], bill, tier, delinq, sig, level, review, rules]; });
  results.push({...writeCsv('reference_data_analysis/28-credit_default_sample.csv',['交易号','账单金额','额度档','最近逾期月数','风险信号','风险等级','复核','命中规则数'],rows),label:'真实基座 UCI Default of Credit Card Clients（CC BY 4.0，30000 名台湾信用卡客户真实违约）'}); }

// ---- product_cases/hospital_ed_timely.csv：真实基座 CMS Timely & Effective Care - Hospital（公共领域/美国政府作品，急诊及时性）----
// 全部真实：医院/州/城市/急诊量级(EDV)/中位急诊时长分(OP_18b)/未就诊离开率(OP_22)/头CT及时率(OP_23)；运营预警由真实等待/流失阈值派生。无合成叠加。
{ const s=readReal('hospital_cms_ed_timely.csv');
  const [iF,iS,iC,iV,i18b,i22,i23]=['Facility','State','City','EDV','OP_18b','OP_22','OP_23'].map(s.col);
  const EDV_CN={'very high':'极高','high':'高','medium':'中','low':'低','very low':'极低'};
  const rows=s.rows.map(row=>{ const wait=Number(row[i18b])||0; const leave=row[i22]===''?'':Number(row[i22]);
    const vol=EDV_CN[(row[iV]||'').trim()]||'未标注';
    const warn = wait>=210?'等待过长' : ((leave!==''&&leave>=4)?'流失偏高' : (wait>=180?'候诊承压':''));
    return [row[iF], row[iS], row[iC], vol, wait, leave, (row[i23]===''?'':row[i23]), warn]; });
  results.push({...writeCsv('product_cases/hospital_ed_timely.csv',['医院','州','城市','急诊量级','中位急诊时长分','未就诊离开率','头CT及时率','运营预警'],rows),label:'真实基座 CMS Timely & Effective Care - Hospital（公共领域，美国急诊及时性）'}); }

// ---- product_cases/flights_ontime.csv：真实基座 US DOT On-Time Performance 2024-06（公共领域，美国政府作品）----
// 全部真实：航班/起飞城市/航司/计划vs实际时长/延误·取消·备降/延误原因。无合成叠加。
{ const s=readReal('flights_usdot_ontime.csv');
  const [iCity,iCar,iCRS,iAct,iArr,iCan,iDiv,iCause]=['起飞城市','航司','计划分','实际分','到达延误分','取消','备降','主延误原因'].map(s.col);
  const rows=s.rows.map((row,i)=>{ const can=row[iCan]==='1', div=row[iDiv]==='1', arr=Number(row[iArr])||0;
    const anom = can?'取消' : div?'备降' : arr>15?'延误' : '';
    const plan=(Number(row[iCRS])||0)/60, act=(Number(row[iAct])||0)/60;
    return ['FL'+String(100000+i), row[iCity], row[iCar], plan.toFixed(1), act.toFixed(1), anom, anom==='延误'?(row[iCause]||'其他'):'' ]; });
  results.push({...writeCsv('product_cases/flights_ontime.csv',['航班号','城市','航司','计划时效h','实际时效h','异常类型','责任方'],rows),label:'真实基座 US DOT On-Time Performance 2024-06（公共领域，611k 航班抽样，起飞城市延误/取消/原因全真实）'}); }
{ const r=rng(302); const rows=[];
  // 分层优先生成：R/F/M 与分层强相关，并埋入「高价值流失」群（历史高 M、近期高 R）——见 dataset/design/case_30.md
  const segs=[
    {name:'重要价值',p:0.08,R:[1,40],F:[30,60],M:[80000,150000]},
    {name:'重要保持',p:0.15,R:[20,90],F:[20,40],M:[50000,100000]},
    {name:'重要发展',p:0.20,R:[10,60],F:[3,15],M:[30000,70000]},
    {name:'高价值流失',p:0.12,R:[180,400],F:[2,10],M:[70000,140000]},
    {name:'一般维持',p:0.25,R:[60,180],F:[5,20],M:[15000,45000]},
    {name:'流失预警',p:0.20,R:[200,400],F:[1,8],M:[5000,30000]},
  ];
  for(let i=0;i<800;i++){ let x=r(),acc=0,seg=segs[segs.length-1]; for(const s of segs){acc+=s.p; if(x<=acc){seg=s;break;}}
    const R=ri(r,seg.R[0],seg.R[1]),F=ri(r,seg.F[0],seg.F[1]),M=Math.round(rf(r,seg.M[0],seg.M[1]));
    const card=M>100000?'白金':M>60000?'金卡':M>35000?'银卡':'普卡'; const miles=Math.round(F*rf(r,2000,4500));
    rows.push(['A'+ri(r,1e5,9e5),card,R,F,M,seg.name,miles]); }
  results.push({...writeCsv('reference_data_analysis/2-air_data.csv',['会员号','卡等级','最近乘机天数','年飞行次数','年消费','分层','里程余额'],rows),label:'教学合成（航空会员 RFM，分层与 R/F/M 强相关、埋高价值流失群）'}); }
{ const r=rng(318); const rows=[]; const camps=['品牌曝光','夏促','新品','回流','会员日'];
  // 数据故事：搜索/会员日 CVR 高（优质）；信息流A 点击高但 CVR 低（落地页问题）——复盘要把预算从量大挪到效率高
  for(const ch of ['信息流A','信息流B','搜索','社交','联盟','视频']){ for(const cp of camps){
    const imp=ri(r,20000,300000); const clk=Math.round(imp*rf(r,0.008,0.06));
    const cvr=(ch==='搜索'||cp==='会员日')?rf(r,0.08,0.18):(ch==='信息流A')?rf(r,0.01,0.035):rf(r,0.02,0.09);
    const cvt=Math.round(clk*cvr); const cost=Math.round(rf(r,clk*0.8,clk*3.2));
    rows.push([cp,ch,imp,clk,cvt,cost,cvt?Math.round(cost/cvt):0,Number((clk/imp).toFixed(4)),Number((cvt/Math.max(1,clk)).toFixed(4))]); }}
  results.push({...writeCsv('reference_data_analysis/18-ad_performance.csv',['活动','渠道','曝光','点击','转化','花费','CPA','CTR','CVR'],rows),label:'教学合成（广告投放漏斗，渠道×活动 30 行，埋落地页/优质渠道差异）'}); }

// 注：原 pm_network_cases/nyc_311 已移除——无案例引用（孤儿），且原实现走 live fetch 破坏构建期可复现。
// 计分案例一律用仓内固定快照（dataset/real/*）或确定性合成，禁止构建期联网。

// 注：原 outputs/05_harness、10_knowledge_gamification、11_loop_engineering 三份 JSON 产物已移除——
// 对应的方法论案例(36/37/43)在 v7 已精简掉，无案例引用（buildFromJson 分支亦随之弃用）。

// ---- MANIFEST ----
// 真实基座快照来源/许可（dataset/real/*，采样自公开数据集、构建期零联网）
const REAL_SOURCES=[
  ['retail_online_retail_ii.csv','UCI Online Retail II','CC BY 4.0','https://archive.ics.uci.edu/dataset/502/online+retail+ii','案例 01/41/45/47 零售基座；14 跨境目的地/单量基座'],
  ['finance_uci_default_credit.csv','UCI Default of Credit Card Clients','CC BY 4.0','https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients','案例 28 金融复核基座（真实违约）'],
  ['hospital_cms_ed_timely.csv','CMS Timely and Effective Care - Hospital','公共领域（美国政府作品）','https://data.cms.gov/provider-data/dataset/yv7e-xc69','案例 16 医院急诊及时性基座'],
  ['flights_usdot_ontime.csv','US DOT On-Time Performance 2024-06','公共领域（美国政府作品）','https://www.transtats.bts.gov/','案例 14 航班准点运营基座（起飞城市延误/取消/原因）'],
];
const man=['# 数据集清单（'+JSON.parse(readFileSync(join(ROOT,'code', 'tools','case_definitions.json'),'utf8')).projectName+'）','',
 '为课堂可复现且诚信：多数计分案例已迁移到**真实公开数据基座**（见下「真实基座快照」，来源/许可/sha256 齐全）；确因源缺失的少数列（如零售毛利率、物流配送时效）为**确定性教学合成叠加**并在「性质」列与案例正文显式标注；其余无真实源的案例为**确定性教学合成**（固定种子）。**绝不把合成说成真实。** 生成：`node code/tools/fetch-datasets.mjs`（读 `dataset/real/*` 快照 → 归一化为中文表头，零联网）。','','| 文件 | 行/项 | 性质 | sha256 |','|---|---|---|---|'];
for(const x of results){ const buf=readFileSync(x.p); const h=createHash('sha256').update(buf).digest('hex').slice(0,16); man.push(`| ${x.rel} | ${x.n??'-'} | ${x.label} | ${h}… |`); }
man.push('','## 真实基座快照（dataset/real/*，采样自公开数据集，构建期零联网）','','| 快照 | 来源 | 许可 | 用于 | sha256 |','|---|---|---|---|---|');
for(const [f,src,lic,url,use] of REAL_SOURCES){ const h=createHash('sha256').update(readFileSync(join(REAL,f))).digest('hex').slice(0,16); man.push(`| dataset/real/${f} | [${src}](${url}) | ${lic} | ${use} | ${h}… |`); }
man.push('','> 快照由一次性采样脚本生成（等距抽样、无随机、无联网）；生成器读快照后归一化。真实列直接用真实效应；缺失列为确定性教学合成叠加、已标注，绝不把叠加说成真实。');
man.push('','结构化 Skill 库：skills/pm_skills.md（手工维护，发布前经 skill_lint.mjs 扫描）。');
man.push('',
  '## vendored 真实素材（非合成，注明来源/许可）',
  '- `assets/vendor/lucide/`：Lucide 图标（github.com/lucide-icons/lucide，ISC 许可），内联进 §1 概念图。',
  '- `assets/vendor/aiagent/`：57 张真实 AI 原理图 + `docs/_source/reference/` 5 份权威文档（源用户提供的 `AI agent/` 参考包），深化 §1。',
  '- `skills/external/pm-skills-deanpeters/`：deanpeters/Product-Manager-Skills（MIT），案例44 RAG 语料。',
  '',
  '## 逐案数据集设计说明',
  '- 精品案例的数据集设计意图/字段义/数据故事见 `dataset/design/case_NN.md`（如 case_30 航空 RFM）。');
writeFileSync(join(DS,'MANIFEST.md'),man.join('\n')+'\n');
console.log('生成数据集', results.length, '个');
console.log(results.map(x=>x.rel+(x.n?`(${x.n})`:'')).join('  '));
