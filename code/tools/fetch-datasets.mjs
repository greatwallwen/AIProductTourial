#!/usr/bin/env node
/**
 * 生成/下载课程数据集到 dataset/。为课堂可复现，默认确定性「教学合成」数据（种子固定，字段与结构
 * 对齐所引用的真实公开数据集，publicRef 见 case_definitions/ MANIFEST）；政务 311 尝试拉真实 Socrata。
 * 禁止把合成数据说成真实——MANIFEST 显式标注 real/synthetic。
 * 用法：node code/tools/fetch-datasets.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
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
// —— 本地化改写（v22）：把 UCI 派生类目 → 中国电商类目、UCI 国家 → 中国省份。**实体标签本地化改写、非 UCI 原始事实**；数值（数量/单价/金额）仍为真实。£→¥ 仅单位语义、数值不变。
const CAT_CN={ '灯饰':'居家灯饰','厨餐':'厨具餐厨','家饰':'家居饰品','文具':'文具图书','箱包':'箱包配饰','玩具':'玩具母婴','节庆':'节庆礼品','园艺':'花园园艺','织品':'家纺织品','其他':'百货其他' };
const CN_PROVINCE=['广东省','浙江省','江苏省','上海市','北京市','山东省','四川省','福建省','湖北省','湖南省','河南省','河北省','安徽省','辽宁省','陕西省','重庆市','江西省','广西','云南省','天津市','山西省','贵州省','黑龙江省','吉林省','内蒙古','新疆','甘肃省','海南省','宁夏','青海省','西藏','其他地区'];
const _provMap=(()=>{ const keys=Object.keys(CN_COUNTRY); const m={}; keys.forEach((k,i)=>{ m[k]=CN_PROVINCE[i%CN_PROVINCE.length]; }); return m; })();
const provOf=(country)=>_provMap[country]||'其他地区';

// ---- order_data.csv：真实基座 UCI Online Retail II（CC BY 4.0）+ 标注合成叠加 ----
// 真实列：订单号/日期/SKU/品类(派生自真实描述)/区域(真实国家译名)/数量/单价/金额/异常原因(真实退货信号)
// 教学合成叠加（源无成本/库存/责任数据，确定性种子、MANIFEST 与正文显式标注）：毛利率/库存天数/责任人/处理时限h
{ const s=readReal('retail_online_retail_ii.csv'); const r=rng(1001);
  const [iInv,iSku,iDesc,iQty,iDate,iPrice,iCty]=['Invoice','StockCode','Description','Quantity','InvoiceDate','Price','Country'].map(s.col);
  const marginBase={'家饰':0.55,'灯饰':0.5,'文具':0.5,'节庆':0.5,'玩具':0.46,'织品':0.44,'厨餐':0.42,'园艺':0.4,'箱包':0.38,'其他':0.36};
  const owners=['仓配-王','运营-李','采购-赵','客服-陈'];
  const rows=s.rows.map(row=>{ const qty=Number(row[iQty])||0, price=Number(row[iPrice])||0; const isReturn=(row[iInv]||'').startsWith('C')||qty<0;
    const rawCat=toCat(row[iDesc]); const cat=CAT_CN[rawCat]||'百货其他'; const region=provOf(row[iCty]); // 本地化改写：中国电商类目 + 中国省份（实体改写、非原始事实）
    const gross=Math.max(0.05,Math.min(0.7,(marginBase[rawCat]??0.4)+(r()-0.5)*0.12)); const stockDays=ri(r,1,180); // 教学合成叠加
    return [row[iInv], row[iDate], row[iSku], cat, region, qty, price, Number((qty*price).toFixed(2)), Number(gross.toFixed(2)), stockDays,
      isReturn?'退货':'', isReturn?pick(r,owners):'', isReturn?ri(r,4,72):'']; });
  results.push({...writeCsv('order_data.csv',['订单号','日期','SKU','品类','区域','数量','单价','金额','毛利率','库存天数','异常原因','责任人','处理时限h'],rows),label:'真实基座 UCI Online Retail II（CC BY 4.0）·真实数值 + 本地化改写实体标签(品类→中国电商类目/区域→中国省份/£→¥单位·非原始地理) + 标注合成叠加(毛利率/库存天数/责任人/处理时限)'}); }

// 注：原 sku.csv / ex-17-RFM.csv / aicourse_hr_employees / aicourse_ecommerce_orders / aicourse_financial_transactions 已移除——均为无案例引用的孤儿合成集。

// 注（v16 ③减法）：案例 14/16/28/31 已裁撤，其数据生成块（flights/hospital/28-credit/18-ad）与真实基座快照随之移除。
// ---- reference_data_analysis/p2p_credit.csv：真实基座 人人贷 P2P（Harvard Dataverse doi:10.7910/DVN/C4RUDY，CC0-1.0，大陆）----
// 真实列直取/log 还原：放款成功(Success)/借款金额(10^col2)/学历等级(col3 序数·不臆造名)/历史成功次数(col4)/授信额度(10^col5)/有征信报告(col6)/描述字数(col7)/有效字符率(col9)/复杂词比例(col11)/主题1-4(col12-15)。
// 规则派生（非事实标签，已标注）：信用画像分层 + 风险信号（供异常队列）。col10 periods 为归一化异常值，弃用（避免误导）。标的 Success=放款成功，非违约。
{ const s=readReal('renrendai_p2p.csv'); const R=s.rows;
  const amt=(row)=>Math.round(Math.pow(10, Number(row[2])||0));
  const lim=(row)=>Math.round(Math.pow(10, Number(row[5])||0));
  const lims=R.map(lim).sort((a,b)=>a-b); const limMed=lims[Math.floor(0.5*(lims.length-1))]||0;
  const rows=R.map(row=>{
    const success=Number(row[1])?1:0, amount=amt(row), edu=(row[3]||'').trim(), succRec=Number(row[4])||0;
    const limit=lim(row), hasReport=Number(row[6])?'有':'无', len=Number(row[7])||0;
    const validRatio=Number(Number(row[9]||0).toFixed(3)), cplx=Number(Number(row[11]||0).toFixed(3));
    const th=[12,13,14,15].map(i=>Number(Number(row[i]||0).toFixed(3)));
    const score=(hasReport==='有'?2:0)+Math.min(succRec,2)+(limit>=limMed?1:0);
    const portrait=score>=4?'优质':score===3?'成长':score===2?'待观察':'薄档';
    const risk=portrait==='薄档'?'高风险薄档':portrait==='待观察'?'需人工复核':'';
    return [row[0],success,amount,edu,succRec,limit,hasReport,len,validRatio,cplx,...th,portrait,risk]; });
  results.push({...writeCsv('reference_data_analysis/p2p_credit.csv',['借款号','放款成功','借款金额','学历等级','历史成功次数','授信额度','有征信报告','描述字数','有效字符率','复杂词比例','主题1','主题2','主题3','主题4','信用画像','风险信号'],rows),label:'真实基座派生（人人贷 P2P，CC0；放款成功/金额/额度/征信/文案特征为真实列直取或 log 还原；信用画像/风险信号为规则派生分层、非事实标签；标的=放款成功非违约）'}); }

// ---- dataset/rag/corpus/*.md + dataset/rag/gold.json：真实基座 webMedQA（中文医疗健康问答，Apache-2.0）----
// 垂直企业 KB：每条答案（正确+干扰）→ 一 .md 作检索语料（store.ts 二元组中文分词）；金标=每题正确答案篇，docPattern 匹配文件基名（answer-selection 原生金标，天然 hit@k 区分度）。
{ const wm=JSON.parse(readFileSync(join(REAL,'webmedqa_slice.json'),'utf8')).groups;
  const corpusDir=join(DS,'rag','corpus'); mkdirSync(corpusDir,{recursive:true});
  for(const f of (existsSync(corpusDir)?readdirSync(corpusDir):[])) if(f.endsWith('.md')) rmSync(join(corpusDir,f)); // 确定性重建（清 CMRC 旧语料）
  const gold=[]; let ci=0;
  wm.forEach((g,gi)=>{ const pad=String(gi).padStart(3,'0');
    const cbase=`med_c${pad}`;
    writeFileSync(join(corpusDir,cbase+'.md'), `# ${g.dept}·问答\n\n问：${g.question}\n\n答：${g.correct}\n`); ci++;
    g.distractors.forEach((d,di)=>{ writeFileSync(join(corpusDir,`med_d${pad}_${di}.md`), `# ${g.dept}·答\n\n${d}\n`); ci++; });
    if(gold.length<60){ const ans=(g.correct||'').replace(/\s/g,''); gold.push({ q:g.question, kw:(ans.slice(0,6)||g.dept), docPattern:cbase }); }
  });
  mkdirSync(join(DS,'rag'),{recursive:true});
  writeFileSync(join(DS,'rag','gold.json'), JSON.stringify(gold,null,2)+'\n');
  writeFileSync(join(DS,'..','code','data','eval_gold.json'), JSON.stringify({gold},null,2)+'\n'); // 同步 eval 金标（eval_harness 读此）
  results.push({ rel:'rag/gold.json', n:gold.length, p:join(DS,'rag','gold.json'), label:'真实基座派生（webMedQA 中文医疗问答 60 题金标；docPattern 匹配正确答案篇 dataset/rag/corpus/med_c*.md；answer-selection 原生金标）' });
  console.log('RAG 医疗语料', ci, '篇 → 金标', gold.length, '题'); }

// 注：原 pm_network_cases/nyc_311 已移除——无案例引用（孤儿），且原实现走 live fetch 破坏构建期可复现。
// 计分案例一律用仓内固定快照（dataset/real/*）或确定性合成，禁止构建期联网。

// 注：原 outputs/05_harness、10_knowledge_gamification、11_loop_engineering 三份 JSON 产物已移除——
// 对应的方法论案例(36/37/43)在 v7 已精简掉，无案例引用（buildFromJson 分支亦随之弃用）。


// ---- reference_data_analysis/2b-real_rfm.csv（v18-P1）：从真实基座 CustomerID/InvoiceDate/Quantity/Price 真算客户级 RFM ----
// R=距快照内最后日期的天数、F=去重发票数、M=Σ数量×单价——全真实；「分层」为分位规则派生（非事实标签，已标注）。案 02 的真实对照。
{ const s=readReal('retail_online_retail_ii.csv');
  const [iInv,iQ,iD,iP,iC]=['Invoice','Quantity','InvoiceDate','Price','CustomerID'].map(s.col);
  const cust=new Map(); let maxD=0;
  for(const r of s.rows){ const c=r[iC]; if(!c) continue; const d=Date.parse(r[iD]); if(!Number.isFinite(d)) continue; maxD=Math.max(maxD,d);
    const o=cust.get(c)||{last:0,inv:new Set(),m:0}; o.last=Math.max(o.last,d); o.inv.add(r[iInv]); o.m+=(Number(r[iQ])||0)*(Number(r[iP])||0); cust.set(c,o); }
  const rows=[...cust.entries()].filter(([,o])=>o.m>0).map(([c,o])=>[c, Math.round((maxD-o.last)/86400000), o.inv.size, Math.round(o.m)]);
  rows.sort((a,b)=>b[3]-a[3]);
  const mSorted=rows.map(r=>r[3]).slice().sort((a,b)=>a-b); const q=(p)=>mSorted[Math.floor(p*(mSorted.length-1))];
  const m50=q(0.5), m85=q(0.85);
  for(const r of rows){ const seg = r[3]>=m85 ? (r[1]>60?'高价值流失(规则)':'重要价值(规则)') : r[3]>=m50 ? '一般保持(规则)' : (r[1]>90?'流失预警(规则)':'普通(规则)'); r.push(seg); }
  results.push({...writeCsv('reference_data_analysis/2b-real_rfm.csv',['客户号','最近购买天数','购买次数','总消费','分层(规则派生)'],rows),label:'真实基座派生（UCI 零售快照 CustomerID 级 RFM 真算；分层为分位规则派生、非事实标签）·**案例03 综合闭环经 /api/rfm 真实消费**（「高价值流失」群=会员经营抓手）'}); }

// 历史可获取真实源（v18：已裁案例的基座不回补为案，此处仅记录可用性）
// ---- MANIFEST ----
// 真实基座快照来源/许可（dataset/real/*，采样自公开数据集、构建期零联网）
const REAL_SOURCES=[
  ['retail_online_retail_ii.csv','UCI Online Retail II','CC BY 4.0','https://archive.ics.uci.edu/dataset/502/online+retail+ii','案例 01/03/05 零售基座（数值真实，实体本地化改写为中国类目/省份）'],
  ['webmedqa_slice.json','webMedQA（中文医疗健康问答）','Apache-2.0','https://github.com/hejunqing/webMedQA','案例 04/07 中文医疗知识库 RAG + 评测（120 组 1正4负·原生 P@1/hit@k 金标；公开健康咨询、无 PII、仅 dev 小切片）'],
  ['renrendai_p2p.csv','人人贷 P2P 借贷记录（Harvard Dataverse doi:10.7910/DVN/C4RUDY·中国大陆）','CC0-1.0','https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/C4RUDY','案例 02 大陆 P2P 信贷·新客vs复借·信用画像分层'],
  ['ruoyi_cloud_arch.json','RuoYi-Cloud（若依·国产开源微服务脚手架）','MIT','https://github.com/yangzongzhuan/RuoYi-Cloud','案例 06 系统架构（22 模块 + 18 真实依赖边 + 0 循环 + 3 Feign 接口契约，pom/@FeignClient 确定性解析，已排除 dependencyManagement）'],
  ['nacos_git_events.json','alibaba/nacos（阿里·国产开源注册/配置中心）','Apache-2.0','https://github.com/alibaba/nacos','案例 09 事件溯源（近 600 提交事件流 + 父指针 DAG，与本仓库 dogfood 小事件流大小对照；作者邮箱已 hash 脱敏）'],
  ['beijing_air_quality.csv','UCI 北京多站点空气质量','CC BY 4.0','https://archive.ics.uci.edu/dataset/501/beijing+multi+site+air+quality+data','案例 05 数据工程·大表查询优化（12 国控站真实逐时·每3小时=140256 行·真实数值/NA 不改；CROSS JOIN 扩规模）'],
  ['dolphinscheduler_devops.json','apache/dolphinscheduler（海豚调度·国产 Apache 顶级项目）','Apache-2.0（元数据为公开事实）','https://github.com/apache/dolphinscheduler','案例 08 研发效能·门禁/返工（近 100 CI=通过率89.1% + 近 100 PR 元数据；作者 handle hash 脱敏）'],
];
const UNWIRED=[['CMS Timely & Effective Care (医院急诊)','https://data.cms.gov/provider-data/dataset/yv7e-xc69'],['US DOT On-Time (航班准点)','https://www.transtats.bts.gov/'],['UCI Default of Credit Card Clients','https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients']];
const man=['# 数据集清单（'+JSON.parse(readFileSync(join(ROOT,'code', 'tools','case_definitions.json'),'utf8')).projectName+'）','',
 '为课堂可复现且诚信：多数计分案例已迁移到**真实公开数据基座**（见下「真实基座快照」，来源/许可/sha256 齐全）；确因源缺失的少数列（如零售毛利率、物流配送时效）为**确定性教学合成叠加**并在「性质」列与案例正文显式标注；其余无真实源的案例为**确定性教学合成**（固定种子）。**绝不把合成说成真实。** 生成：`node code/tools/fetch-datasets.mjs`（读 `dataset/real/*` 快照 → 归一化为中文表头，零联网）。','','| 文件 | 行/项 | 性质 | sha256 |','|---|---|---|---|'];
for(const x of results){ const buf=readFileSync(x.p); const h=createHash('sha256').update(buf).digest('hex').slice(0,16); man.push(`| ${x.rel} | ${x.n??'-'} | ${x.label} | ${h}… |`); }
man.push('','## 真实基座快照（dataset/real/*，采样自公开数据集，构建期零联网）','','| 快照 | 来源 | 许可 | 用于 | sha256 |','|---|---|---|---|---|');
for(const [f,src,lic,url,use] of REAL_SOURCES){ const h=createHash('sha256').update(readFileSync(join(REAL,f))).digest('hex').slice(0,16); man.push(`| dataset/real/${f} | [${src}](${url}) | ${lic} | ${use} | ${h}… |`); }
man.push('','> **零售快照**由一次性采样脚本生成（分层过采样：退货约 ×5 以便教学展示，异常率 11.1% 不代表真实业务水平——UCI 原始约 2%；无随机、无联网），生成器读快照后归一化，真实数值列直接用真实效应、实体标签本地化改写（已标注）。**人人贷** 为公开集**直接快照**（未过采样、未改数值），仅归一化中文表头与 log 还原、规则派生分层均已标注为「派生·非事实标签」；**webMedQA** 取 dev 小切片（120 组 1正4负、公开健康咨询、无 PII）；国产开源真集（若依/nacos/海豚调度）为确定性解析/脱敏快照（pom·git·REST 元数据，邮箱/handle 已 hash）。缺失列的确定性教学合成叠加已标注，绝不把叠加/派生说成真实。');
man.push('','## 可用但刻意未接线的真实源（v17 瘦身裁撤，回补须先有案例与教学理由）','',...UNWIRED.map(([n,u])=>`- ${n}：${u}`));
man.push('','结构化 Skill 库：skills/pm_skills.md（手工维护，发布前经 skill_lint.mjs 扫描）。');
man.push('',
  '## vendored 真实素材（非合成，注明来源/许可）',
  '- `assets/vendor/lucide/`：Lucide 图标（github.com/lucide-icons/lucide，ISC 许可），内联进 §1 概念图。',
  '- `assets/vendor/aiagent/`：55 张真实 AI 原理图 + `docs/_source/reference/` 5 份权威文档（源用户提供的 `AI agent/` 参考包），深化 §1。**许可待确认**：图包未附 LICENSE/README 等授权说明，商业发售前须取得书面授权或替换（§1 引用图清单与替换预案见 `outputs/aiagent_license_todo.md`）。',
  '- `skills/external/pm-skills-deanpeters/`：deanpeters/Product-Manager-Skills（MIT），早期英文 RAG 语料（已由 CMRC2018 中文语料取代为案例 04/07 主语料，保留作英文对照）。',
  '- `dataset/rag/corpus/`：CMRC2018 dev 派生中文语料（每 context 一 .md，供 store.ts 检索）；`dataset/rag/gold.json`：60 题中文金标。**CC BY-SA-4.0（署名 + 相同方式共享）**，仅教学引用、不商业再分发衍生。',
  '',
  '## 逐案数据集设计说明',
  '- 精品案例的数据集设计意图/字段义/数据故事见 `dataset/design/case_NN.md`。');
writeFileSync(join(DS,'MANIFEST.md'),man.join('\n')+'\n');
console.log('生成数据集', results.length, '个');
console.log(results.map(x=>x.rel+(x.n?`(${x.n})`:'')).join('  '));
