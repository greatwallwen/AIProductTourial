#!/usr/bin/env node
/**
 * 下载真实公开数据集并重整为各案例工程的种子输入（committed 小文件）。
 * 原始大文件落在 dataset/_raw/（.gitignore 忽略）；本脚本产出的 dataset/<case>/ 小文件入库。
 * 网络只在此脚本运行时使用；工程测试/种子一律离线读取 committed 文件。
 *
 * 用法：node scripts/fetch-datasets.mjs [03|04|01|all]
 * 产物校验和写入 dataset/MANIFEST.md（本脚本打印，供人工核对/粘贴）。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DS = join(ROOT, 'dataset');
const RAW = join(DS, '_raw');
const which = process.argv[2] ?? 'all';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
async function fetchText(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': 'productDemo-dataset-fetch', ...headers } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---------- 案例三：UCI-447 液压系统状态监测 → 遥测窗口 ----------
const HYD_URL =
  'https://archive.ics.uci.edu/static/public/447/condition+monitoring+of+hydraulic+systems.zip';
const HYD_DIR = join(RAW, 'hydraulic');
const HYD_MEMBERS = ['PS2.txt', 'TS1.txt', 'TS3.txt', 'VS1.txt', 'CE.txt', 'CP.txt', 'FS1.txt', 'profile.txt'];

async function ensureHydraulic() {
  if (HYD_MEMBERS.every((m) => existsSync(join(HYD_DIR, m)))) return;
  mkdirSync(RAW, { recursive: true });
  const zip = join(RAW, 'hydraulic.zip');
  if (!existsSync(zip)) writeFileSync(zip, await fetchBuffer(HYD_URL));
  mkdirSync(HYD_DIR, { recursive: true });
  execFileSync('unzip', ['-o', zip, ...HYD_MEMBERS, '-d', HYD_DIR], { stdio: 'ignore' });
}
function cycleMeans(member) {
  const rows = readFileSync(join(HYD_DIR, member), 'utf8').trim().split('\n');
  return rows.map((r) => {
    const v = r.split(/\t/);
    let s = 0;
    for (const x of v) s += +x;
    return s / v.length;
  });
}
async function build03() {
  await ensureHydraulic();
  const ch = {
    PS2: cycleMeans('PS2.txt'), TS1: cycleMeans('TS1.txt'), TS3: cycleMeans('TS3.txt'),
    VS1: cycleMeans('VS1.txt'), CE: cycleMeans('CE.txt'), CP: cycleMeans('CP.txt'), FS1: cycleMeans('FS1.txt'),
  };
  const prof = readFileSync(join(HYD_DIR, 'profile.txt'), 'utf8').trim().split('\n').map((r) => r.split(/\t/).map(Number));
  // 构造"健康 40h → 冷却器失效"退化时间线：真实周期，数值未改，仅按冷却器状态选取与排序。
  // 健康段取冷却器满效（100%）且油温/冷却效率明确正常的周期；故障段取冷却器近失效（3%）且明确越限的周期。
  const healthy = prof.map((_, i) => i).filter((i) => prof[i][0] === 100 && ch.TS1[i] < 46 && ch.CE[i] > 32);
  const fault = prof.map((_, i) => i).filter((i) => prof[i][0] === 3 && ch.TS1[i] > 52 && ch.CE[i] < 24);
  const pick = [...healthy.slice(0, 456), ...fault.slice(0, 120)];
  const round = (x, d) => Number(x.toFixed(d));
  const header = 'cycle,cooler,valve,pump,accum,PS2_bar,TS1_C,TS3_C,VS1_mms,CE_pct,CP_kW,FS1_lmin';
  const lines = pick.map((i) => [
    i, prof[i][0], prof[i][1], prof[i][2], prof[i][3],
    round(ch.PS2[i], 2), round(ch.TS1[i], 2), round(ch.TS3[i], 2), round(ch.VS1[i], 3),
    round(ch.CE[i], 1), round(ch.CP[i], 2), round(ch.FS1[i], 2),
  ].join(','));
  const out = join(DS, '03-device-monitor');
  mkdirSync(out, { recursive: true });
  const f = join(out, 'hydraulic-window.csv');
  writeFileSync(f, header + '\n' + lines.join('\n') + '\n');
  return { f, n: pick.length };
}

// ---------- 案例四：GitHub Issues（每个公开仓 = 一个租户）→ 工单 ----------
const REPOS = [
  { code: 'SUPABASE', company: 'Supabase Inc.', repo: 'supabase/supabase' },
  { code: 'PRISMA', company: 'Prisma Data, Inc.', repo: 'prisma/prisma' },
  { code: 'VERCEL', company: 'Vercel Inc.', repo: 'vercel/next.js' },
];
async function build04() {
  const out = [];
  for (const t of REPOS) {
    // state=all 拉最近更新的 issue（pull_request 字段的排除掉，只留纯 issue）
    const raw = JSON.parse(
      await fetchText(`https://api.github.com/repos/${t.repo}/issues?state=all&per_page=100&sort=created&direction=desc`, {
        accept: 'application/vnd.github+json',
      })
    );
    const issues = raw
      .filter((i) => !i.pull_request)
      .slice(0, 18)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state, // open | closed
        createdAt: i.created_at,
        closedAt: i.closed_at,
        labels: (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name)),
      }));
    out.push({ code: t.code, company: t.company, repo: t.repo, issues });
  }
  const dir = join(DS, '04-saas-ticket');
  mkdirSync(dir, { recursive: true });
  const f = join(dir, 'issues.json');
  writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
  return { f, n: out.reduce((a, t) => a + t.issues.length, 0) };
}

// ---------- 案例一：GB/T 2260 全国行政区划 → 区划子集 ----------
const GH_RAW = 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist';
// 案例配套事项覆盖的若干真实市辖区（含种子使用的上海徐汇 310104）
const DISTRICTS = ['310104', '310115', '110105', '440304', '330106', '510107'];
async function build01() {
  // 每行首两列为 code,"name"（后续列为上级码），统一取前两列
  const parse = (csv) =>
    csv.trim().split('\n').slice(1).map((l) => {
      const m = l.match(/^(\d+),"([^"]*)"/);
      return m ? [m[1], m[2]] : null;
    }).filter(Boolean);
  const provByCode = new Map(parse(await fetchText(`${GH_RAW}/provinces.csv`))); // 2 位
  const cityByCode = new Map(parse(await fetchText(`${GH_RAW}/cities.csv`)));     // 4 位
  const areaByCode = new Map(parse(await fetchText(`${GH_RAW}/areas.csv`)));      // 6 位
  const rows = DISTRICTS.map((code) => ({
    code,
    name: areaByCode.get(code) ?? '',
    city: cityByCode.get(code.slice(0, 4)) ?? '',
    province: provByCode.get(code.slice(0, 2)) ?? '',
  }));
  const dir = join(DS, '01-gov-approval');
  mkdirSync(dir, { recursive: true });
  const f = join(dir, 'divisions.json');
  writeFileSync(f, JSON.stringify(rows, null, 2) + '\n');
  return { f, n: rows.length };
}

// ---------- 案例二：GB/T 2260 省 + 市 → 合同相对方注册地校验集 ----------
async function build02() {
  const parse = (csv) =>
    csv.trim().split('\n').slice(1).map((l) => {
      const m = l.match(/^(\d+),"([^"]*)"/);
      return m ? [m[1], m[2]] : null;
    }).filter(Boolean);
  const provinces = parse(await fetchText(`${GH_RAW}/provinces.csv`)); // [code2, name]
  const cities = parse(await fetchText(`${GH_RAW}/cities.csv`));         // [code4, name]
  const rows = [
    ...provinces.map(([code, name]) => ({ code, name, level: 'province' })),
    ...cities.map(([code, name]) => ({ code, name, level: 'city' })),
  ];
  const dir = join(DS, '02-contract-ledger');
  mkdirSync(dir, { recursive: true });
  const f = join(dir, 'regions.json');
  writeFileSync(f, JSON.stringify(rows, null, 2) + '\n');
  return { f, n: rows.length };
}

const BUILDERS = { '03': build03, '04': build04, '01': build01, '02': build02 };
const run = which === 'all' ? Object.keys(BUILDERS) : [which];
const results = [];
for (const k of run) {
  process.stdout.write(`构建 ${k} … `);
  const r = await BUILDERS[k]();
  results.push({ case: k, ...r });
  console.log(`${r.n} 条 → ${r.f.replace(ROOT + '/', '')}`);
}
console.log('\n=== sha256（写入 dataset/MANIFEST.md）===');
for (const r of results) console.log(`${sha256(r.f)}  ${r.f.replace(ROOT + '/', '')}`);
