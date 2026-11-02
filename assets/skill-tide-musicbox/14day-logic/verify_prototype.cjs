const {chromium} = require('/home/fq/AIProductTourial/code/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
  const errors = [];
  const checks = {};
  try {
    const page = await browser.newPage({viewport: {width: 1360, height: 900}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'prototype14-logic.html')).href);
    assert.equal(await page.evaluate(() => SOURCE.length), 3360);
    assert.equal(await page.locator('#notes tr').count(), 16);
    assert.equal(await page.locator('#tabs [role="tab"]').count(), 3);
    assert.match(await page.locator('#metrics').innerText(), /3 种音高/);
    assert.match(await page.locator('#metrics').innerText(), /4 种音高/);
    checks.initial = '3360 verified records; same-source 16-note comparison; three guided cases';
    const firstRecord = await page.evaluate(() => JSON.stringify(SOURCE[60]));

    await page.locator('[data-free="middle"]').click();
    assert.match(await page.locator('#state').innerText(), /2025-04-07 12:00/);
    assert.match(await page.locator('#metrics').innerText(), /5 种音高/);
    await page.locator('[data-free="last"]').click();
    assert.match(await page.locator('#state').innerText(), /2025-04-14 18:00/);
    assert.match(await page.locator('#metrics').innerText(), /4 种音高/);
    await page.locator('[data-free="first"]').click();
    await page.locator('[data-free="old"]').click();
    assert.match(await page.locator('#state').innerText(), /只看潮高/);
    await page.locator('[data-free="new"]').click();
    assert.match(await page.locator('#state').innerText(), /潮高＋涨落/);
    await page.locator('[data-free="edit"]').click();
    assert.match(await page.locator('#notes tr').nth(2).innerText(), /人工/);
    assert.equal(await page.evaluate(() => JSON.stringify(SOURCE[60])), firstRecord);
    checks.rules = {sameThreeHourSources: true, distinctPitchesByDay: [4, 5, 4], editsDoNotTouchSource: true};

    await page.locator('[data-free="place0"]').click();
    await page.locator('[data-free="middle"]').click();
    await page.locator('[data-free="place1"]').click();
    await page.locator('[data-free="last"]').click();
    await page.locator('[data-free="place2"]').click();
    assert.deepEqual(await page.evaluate(() => draft.slots.map(slot => slot.start)), [60, 1560, 3300]);
    await page.locator('[data-free="reopen0"]').click();
    assert.equal(await page.evaluate(() => draft.working.edits[2].shift), 4);
    await page.locator('[data-free="invalid"]').click();
    assert.match(await page.locator('#feedback').innerText(), /已拒绝.*越界/);
    await page.locator('[data-free="quality"]').click();
    assert.match(await page.locator('#feedback').innerText(), /教学注入.*质量/);
    assert.deepEqual(await page.evaluate(() => draft.slots.map(slot => slot.start)), [60, 1560, 3300]);
    checks.states = 'independent slots, reopened edit, invalid selection and injected quality both rejected';

    await page.locator('[data-play="height"]').click();
    await page.waitForFunction(() => document.querySelector('#player').duration > 0);
    const oldDuration = await page.locator('#player').evaluate(player => player.duration);
    await page.locator('[data-play="contour"]').click();
    await page.waitForFunction(() => document.querySelector('#player').duration > 0);
    const newDuration = await page.locator('#player').evaluate(player => player.duration);
    assert.notEqual(Math.round(oldDuration * 10), Math.round(newDuration * 10));
    await page.locator('#stop').click();
    checks.sound = {oldDuration, newDuration, stopped: await page.locator('#player').evaluate(player => player.paused)};
    await page.screenshot({path: path.join(__dirname, 'prototype-desktop.png'), fullPage: true});

    await page.getByRole('tab', {name: '异常不能混入'}).click();
    assert.equal(await page.evaluate(() => draft.slots.filter(Boolean).length), 0);
    await page.locator('[data-step="0"]').click();
    assert.match(await page.locator('#feedback').innerText(), /越界/);
    await page.locator('[data-step="1"]').click();
    assert.match(await page.locator('#feedback').innerText(), /教学注入/);
    await page.locator('[data-step="2"]').click();
    assert.match(await page.locator('#state').innerText(), /2025-04-01 06:00/);
    checks.walkthrough = 'scenario tab resets state; all guided steps execute real actions';

    await page.setViewportSize({width: 390, height: 844});
    await page.screenshot({path: path.join(__dirname, 'prototype-mobile.png'), fullPage: true});
    checks.mobile = await page.evaluate(() => ({width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth}));
    assert.ok(checks.mobile.scrollWidth <= checks.mobile.width, JSON.stringify(checks.mobile));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(__dirname, 'browser-check.json'), JSON.stringify({checks, errors}, null, 2) + '\n');
    console.log(JSON.stringify({checks, errors}, null, 2));
  } finally { await browser.close() }
})().catch(error => {console.error(error); process.exitCode = 1});
