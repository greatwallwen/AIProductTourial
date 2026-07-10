#!/usr/bin/env node
/** 截图 + 边车传感器（v20）：遍历 case_definitions 全部案例，抓 premium_case_NN_slug_desktop.png 的同时，
 *  从活页面 DOM 导出边车 JSON（品牌/案例数/页头 H1/该案 KPI 名值对）+ png 字节粗检防纯色空白。
 *  verify_course_package.mjs 逐案核对边车 vs code/data/case_NN.json——「图」与「数」对不上即红，
 *  终结「verify 只查截图文件存在」的验证剧场（§2.8b）。
 *  前置：服务已起（PORT=5200 node --experimental-sqlite code/server/app.ts，托管 code/web/dist）。
 *  用法：node code/tools/screenshot_cases.mjs [num...]   （不带参数=全量）
 *  依赖：playwright-core（不随仓库装；npm i -D playwright-core，或设 PLAYWRIGHT_CORE=/abs/path/to/playwright-core/index.mjs）
 *        浏览器用系统 chromium（CHROMIUM_BIN 可覆盖，默认 /usr/bin/chromium）。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'assets', 'screenshots');
const BASE = process.env.SHOT_BASE || 'http://localhost:5200';
const MIN_PNG_BYTES = 50000; // 1440x900@2x 的真实工作台截图远大于此；纯色/空白页压缩后到不了
const pad = (n) => String(n).padStart(2, '0');

async function loadChromium() {
  for (const cand of [process.env.PLAYWRIGHT_CORE, 'playwright-core'].filter(Boolean)) {
    try {
      const loaded = await import(cand);
      const chromium = loaded.chromium ?? loaded.default?.chromium;
      if (chromium) return chromium;
    } catch { /* 尝试下一候选 */ }
  }
  console.error('✗ 找不到 playwright-core：npm i -D playwright-core，或设 PLAYWRIGHT_CORE=/abs/path/to/playwright-core/index.mjs');
  process.exit(1);
}

// 边车抽取（在页面上下文执行）：品牌=侧栏品牌元素、案例数=侧栏副标题、H1=案例页头、KPI=标准 .kpis 指标行名值对
function extractSidecar() {
  const txt = (el) => (el?.textContent || '').trim();
  const brand = txt(document.querySelector('.sb-title'));
  const caseCount = Number((txt(document.querySelector('.sb-sub')).match(/(\d+)\s*案例/) || [])[1] || 0);
  const h1 = txt(document.querySelector('.main .topbar h1'));
  const kpis = [...document.querySelectorAll('.kpis .kpi')].map((k) => {
    const name = txt(k.querySelector('.kpi-name'));
    const valEl = k.querySelector('.kpi-val');
    let value = '';
    if (valEl) { const c = valEl.cloneNode(true); for (const u of c.querySelectorAll('.kpi-unit')) u.remove(); value = (c.textContent || '').trim(); }
    return { name, value };
  }).filter((k) => k.name);
  return { brand, caseCount, h1, kpis };
}

const defs = JSON.parse(readFileSync(join(ROOT, 'code', 'tools', 'case_definitions.json'), 'utf8'));
const only = process.argv.slice(2).map(Number).filter(Number.isFinite);
const cases = only.length ? defs.cases.filter((c) => only.includes(c.num)) : defs.cases;

const chromium = await loadChromium();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

let fail = 0;
for (const c of cases) {
  const stem = `premium_case_${pad(c.num)}_${c.slug}_desktop`;
  const url = `${BASE}/#/case/${pad(c.num)}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.main .topbar h1', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500); // 专属屏 live fetch（/api/search、/api/gates…）落定
    const buf = await page.screenshot({ path: join(OUT, `${stem}.png`) });
    const dom = await page.evaluate(extractSidecar);
    const sidecar = { num: c.num, slug: c.slug, url, shotAt: new Date().toISOString(), ...dom, pngBytes: buf.length };
    writeFileSync(join(OUT, `${stem}.json`), JSON.stringify(sidecar, null, 1) + '\n');
    const blank = buf.length < MIN_PNG_BYTES;
    if (blank) { fail++; console.error(`  ✗ ${pad(c.num)} ${c.slug} 截图疑似纯色空白（${buf.length} bytes < ${MIN_PNG_BYTES}）`); }
    else console.log(`  ✔ ${pad(c.num)} ${c.slug} png=${buf.length}B kpi=${dom.kpis.length} 品牌=「${dom.brand}」 H1=「${dom.h1}」`);
  } catch (e) {
    fail++; console.error(`  ✗ ${pad(c.num)} ${c.slug} 截图失败：${e.message}`);
  }
}
await browser.close();
console.log(`\nscreenshot_cases: ${cases.length - fail}/${cases.length} 张 + 边车 JSON → assets/screenshots/`);
if (fail) process.exit(1);
