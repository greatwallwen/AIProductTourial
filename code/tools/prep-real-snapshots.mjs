#!/usr/bin/env node
/** 一次性：把大体量真实公开数据集 → 采样为小而确定的仓内快照 dataset/real/*.csv。
 *  确定性（等距抽样，无随机），无联网。源文件在 scratchpad/dl（不入库）。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash as hash } from 'node:crypto';
import { join } from 'node:path';
const DL = process.env.REAL_SOURCES_DIR || "/tmp/pm-kb-real-sources"; // 放置从 MANIFEST 中各 URL 下载的原始文件（online_retail_II.csv / default of credit card clients.csv / cms_timely.csv）
const REAL = '/home/claudecode/workspace/productDemo/dataset/real';
mkdirSync(REAL, { recursive: true });

// 稳健 CSV 解析（支持引号内逗号/转义引号）
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c === '\r') { } else cur += c; }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const toCSV = (rows) => rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n') + '\n';
const sha16 = (p) => hash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const report = [];

// ---------- 1) 零售：UCI Online Retail II（CC BY 4.0）----------
{
  const rows = parseCSV(readFileSync(join(DL, 'online_retail_II.csv'), 'utf8'));
  const head = rows[0]; const body = rows.slice(1).filter(r => r.length >= 8);
  // 保留：有效单价>0、有国家、数量≠0（含退货负数量）。等距抽样到 ~4500，退货全保留以保住真实退货信号。
  const valid = body.filter(r => Number(r[5]) > 0 && (r[7] || '').trim() && Number(r[3]) !== 0);
  const returns = valid.filter(r => (r[0] || '').startsWith('C') || Number(r[3]) < 0);
  const normal = valid.filter(r => !((r[0] || '').startsWith('C') || Number(r[3]) < 0));
  // 正常单等距抽 ~4000、退货等距抽 ~500，都确定性，保住真实退货信号与国家分布
  const pick = (arr, n) => { const s = Math.max(1, Math.floor(arr.length / n)); return arr.filter((_, i) => i % s === 0).slice(0, n); };
  const sampled = pick(normal, 4000).concat(pick(returns, 500));
  const out = [['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'CustomerID', 'Country'],
    ...sampled.map(r => [r[0], r[1], (r[2] || '').trim(), r[3], (r[4] || '').slice(0, 10), r[5], r[6], (r[7] || '').trim()])];
  const p = join(REAL, 'retail_online_retail_ii.csv'); writeFileSync(p, toCSV(out));
  report.push(['retail_online_retail_ii.csv', out.length - 1, sha16(p)]);
  // 校验真实效应：按国家真实营收
  const rev = {}; for (const r of sampled) { const amt = Number(r[3]) * Number(r[5]); rev[(r[7] || '').trim()] = (rev[(r[7] || '').trim()] || 0) + amt; }
  const topC = Object.entries(rev).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${Math.round(v)}`);
  console.log('零售样本', out.length - 1, '行；退货', returns.length, '；国家营收Top', topC.join(' '));
}

// ---------- 2) 金融：UCI Default of Credit Card Clients（CC BY 4.0）----------
{
  const rows = parseCSV(readFileSync(join(DL, 'default of credit card clients.csv'), 'utf8'));
  // 行1=X1..Y；行2=真实列名；数据从行3
  const names = rows[1]; const body = rows.slice(2).filter(r => r.length >= 25 && r[0]);
  const stride = Math.max(1, Math.floor(body.length / 3000));
  const sampled = body.filter((_, i) => i % stride === 0).slice(0, 3000);
  const out = [names, ...sampled];
  const p = join(REAL, 'finance_uci_default_credit.csv'); writeFileSync(p, toCSV(out));
  report.push(['finance_uci_default_credit.csv', out.length - 1, sha16(p)]);
  // 校验：违约率随额度分档变化（真实效应）
  const bucket = (lb) => lb < 50000 ? '低额度' : lb < 150000 ? '中额度' : '高额度';
  const agg = {}; for (const r of sampled) { const b = bucket(Number(r[1])); (agg[b] ||= { n: 0, d: 0 }); agg[b].n++; if (r[24] === '1') agg[b].d++; }
  console.log('金融样本', out.length - 1, '行；违约率/额度档', Object.entries(agg).map(([k, v]) => `${k}:${(v.d / v.n * 100).toFixed(1)}%`).join(' '));
}

// ---------- 3) 医院：CMS Timely & Effective Care - Hospital（公共领域）----------
{
  const rows = parseCSV(readFileSync(join(DL, 'cms_timely.csv'), 'utf8'));
  const H = rows[0]; const idx = (n) => H.indexOf(n);
  const fI = idx('Facility ID'), fN = idx('Facility Name'), cI = idx('City/Town'), sI = idx('State'), mI = idx('Measure ID'), scI = idx('Score');
  // 透视：每医院收 ED 相关指标
  const fac = {};
  for (const r of rows.slice(1)) {
    if (r.length <= scI) continue; const id = r[fI]; if (!id) continue;
    (fac[id] ||= { id, name: r[fN], city: r[cI], state: r[sI], m: {} });
    fac[id].m[r[mI]] = r[scI];
  }
  const num = (v) => /^[0-9]+$/.test(String(v || '').trim()) ? Number(v) : null;
  const list = Object.values(fac).filter(f => num(f.m['OP_18b']) != null); // 有真实中位急诊时长
  const out = [['FacilityID', 'Facility', 'State', 'City', 'EDV', 'OP_18b', 'OP_18a', 'OP_22', 'OP_23'],
    ...list.map(f => [f.id, f.name, f.state, f.city, (f.m['EDV'] || '').trim(), f.m['OP_18b'] || '', f.m['OP_18a'] || '', num(f.m['OP_22']) ?? '', num(f.m['OP_23']) ?? ''])];
  const p = join(REAL, 'hospital_cms_ed_timely.csv'); writeFileSync(p, toCSV(out));
  report.push(['hospital_cms_ed_timely.csv', out.length - 1, sha16(p)]);
  // 校验真实效应：中位急诊时长随急诊量级递增
  const agg = {}; for (const f of list) { const k = (f.m['EDV'] || '—').trim(); (agg[k] ||= { n: 0, w: 0, left: 0, lc: 0 }); agg[k].n++; agg[k].w += Number(f.m['OP_18b']); const lv = num(f.m['OP_22']); if (lv != null) { agg[k].left += lv; agg[k].lc++; } }
  console.log('医院样本', out.length - 1, '家；均急诊时长(分)/量级', Object.entries(agg).map(([k, v]) => `${k}:${Math.round(v.w / v.n)}分/离开${v.lc ? (v.left / v.lc).toFixed(1) : '—'}%`).join('  '));
}

// ---------- 4) 运输准点：US DOT On-Time Performance（公共领域，美国政府作品）----------
{
  const rows = parseCSV(readFileSync(join(DL, 'On_Time_Reporting_Carrier_On_Time_Performance_(1987_present)_2024_6.csv'), 'utf8'));
  const H = rows[0]; const idx = (n) => H.indexOf(n);
  const iCity = idx('OriginCityName'), iSt = idx('OriginState'), iCar = idx('Reporting_Airline'),
    iCRS = idx('CRSElapsedTime'), iAct = idx('ActualElapsedTime'), iArr = idx('ArrDelay'),
    iCan = idx('Cancelled'), iDiv = idx('Diverted'),
    iCD = idx('CarrierDelay'), iWD = idx('WeatherDelay'), iND = idx('NASDelay'), iSD = idx('SecurityDelay'), iLD = idx('LateAircraftDelay');
  const n = (v) => Number(v) || 0;
  const body = rows.slice(1).filter((r) => r.length > iLD && r[iCity] && n(r[iCRS]) > 0);
  const stride = Math.max(1, Math.floor(body.length / 1500));
  const sampled = body.filter((_, i) => i % stride === 0).slice(0, 1500);
  const cause = (r) => { const c = [['航司', n(r[iCD])], ['天气', n(r[iWD])], ['空管', n(r[iND])], ['安检', n(r[iSD])], ['前序航班晚到', n(r[iLD])]].sort((a, b) => b[1] - a[1]); return c[0][1] > 0 ? c[0][0] : '其他'; };
  const out = [['起飞城市', '州', '航司', '计划分', '实际分', '到达延误分', '取消', '备降', '主延误原因'],
    ...sampled.map((r) => [r[iCity], r[iSt], r[iCar], n(r[iCRS]), n(r[iAct]), n(r[iArr]), n(r[iCan]) >= 1 ? '1' : '0', n(r[iDiv]) >= 1 ? '1' : '0', n(r[iArr]) > 15 ? cause(r) : ''])];
  const p = join(REAL, 'flights_usdot_ontime.csv'); writeFileSync(p, toCSV(out));
  report.push(['flights_usdot_ontime.csv', out.length - 1, sha16(p)]);
}

console.log('\n=== dataset/real 快照 ===');
for (const [f, n, h] of report) console.log(`${f}\t${n}行\tsha256:${h}…`);
