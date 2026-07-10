import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..', '..');
const checker = join(ROOT, 'code', 'tools', 'check_my_work.mjs');

test('generated structured example passes', () => {
  const sample = join(ROOT, 'outputs', 'product_case_library', 'case_02_airline_member_rfm_方案验收.md');
  const run = spawnSync(process.execPath, [checker, '02', sample, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(JSON.parse(run.stdout).ok, true);
});

test('keyword stuffing without required sections fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'course-attempt-'));
  const file = join(dir, 'stuffed.md');
  writeFileSync(file, '会员号 卡等级 最近乘机天数 年飞行次数 年消费 分层 里程余额 会员数 高价值流失 rfm-segmentation 按 R/F/M 分层识别高价值流失群', 'utf8');
  const run = spawnSync(process.execPath, [checker, '02', file, '--json'], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stdout).ok, false);
});
