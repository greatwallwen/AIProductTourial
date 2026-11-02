const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const artifact = path.resolve(__dirname, '../../../code/cases/bedroom-layout-studio/skill-web-artifacts-builder/bundle.html');
const browserOptions = {headless: true};
if (process.env.CHROME_PATH) browserOptions.executablePath = process.env.CHROME_PATH;

async function verify() {
  const browser = await chromium.launch(browserOptions);
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, acceptDownloads: true});
    const pageErrors = [];
    const remoteRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => {
      if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
    });
    await page.goto(pathToFileURL(artifact).href);
    await page.getByRole('heading', {name: '书桌放在哪里，亲手试一试。'}).waitFor();

    await page.getByRole('button', {name: /候选书桌 B/}).first().click();
    await page.getByRole('button', {name: '保存为方案 A'}).click();
    await page.locator('svg.room-map').first().getByRole('button', {name: /已有衣柜，位置横向/}).click();
    await page.locator('svg.room-map').first().getByRole('button', {name: /旋转已有衣柜 90°/}).click();
    const overlapWarning = await page.getByText(/已有衣柜与候选书桌 B重叠/).count() > 0;
    const saveBlocked = await page.getByRole('button', {name: '保存为方案 B'}).isDisabled();

    await page.getByRole('button', {name: '恢复原始布局'}).click();
    await page.getByRole('button', {name: /候选书桌 C/}).first().click();
    await page.locator('svg.room-map').first().getByRole('button', {name: /候选书桌 C，位置横向/}).click();
    await page.locator('svg.room-map').first().getByRole('button', {name: /旋转候选书桌 C 90°/}).click();
    const rotateOnMap = await page.getByText('已旋转 90°').count() > 0;
    await page.getByRole('button', {name: '保存为方案 B'}).click();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', {name: '导出两方案 PNG'}).click();
    const download = await downloadEvent;
    const pngPath = path.join(__dirname, 'skill-comparison.png');
    const downloadedPng = fs.readFileSync(await download.path());
    assert.equal(downloadedPng.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual(downloadedPng, fs.readFileSync(pngPath));

    await page.reload();
    const savedLabels = await page.locator('.snapshot > div:first-child > div.rounded-md').allTextContents();
    await page.getByRole('button', {name: '恢复方案 A 继续编辑'}).click();
    const restored = page.locator('svg.room-map').first().getByRole('button', {name: /候选书桌 B，位置横向230厘米/});
    const restoreA = await restored.count() > 0;
    await restored.scrollIntoViewIfNeeded();
    const box = await restored.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 10, {steps: 6});
    await page.mouse.up();
    const dragLabel = await page.locator('svg.room-map').first().getByRole('button', {name: /候选书桌 B，位置横向/}).getAttribute('aria-label') || '';
    const dragMove = dragLabel.includes('候选书桌 B，位置横向') && !dragLabel.includes('位置横向230厘米');

    await page.getByRole('textbox', {name: '名称'}).fill('模拟阅读灯');
    await page.getByRole('button', {name: '加入房间'}).click();
    const customFurniture = await page.locator('svg.room-map').first().getByRole('button', {name: /模拟阅读灯，位置横向/}).count() > 0;
    await page.locator('svg.room-map').first().getByRole('button', {name: /已有床，位置横向25厘米/}).focus();
    await page.keyboard.press('ArrowRight');
    const keyboardMove = await page.locator('svg.room-map').first().getByRole('button', {name: /已有床，位置横向30厘米/}).count() > 0;
    await page.setViewportSize({width: 390, height: 844});
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    const result = {artifact: 'skill-web-artifacts-builder/bundle.html', overlapWarning, saveBlocked,
      rotateOnMap, savedLabels, downloadedPngBytes: downloadedPng.length, restoreA, dragMove,
      customFurniture, keyboardMove, mobileOverflow, pageErrors, remoteRequests};
    assert.equal(overlapWarning && saveBlocked && rotateOnMap && restoreA && dragMove && customFurniture && keyboardMove, true);
    assert.deepEqual(savedLabels, ['候选书桌 B', '候选书桌 C']);
    assert.ok(downloadedPng.length > 10000);
    assert.equal(mobileOverflow, 0);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(remoteRequests, []);
    fs.writeFileSync(path.join(__dirname, 'browser-final-check.json'), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
