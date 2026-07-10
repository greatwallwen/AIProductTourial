#!/usr/bin/env node
import { runBoundedLoop } from './engine.mjs';

const scenarioAt = process.argv.indexOf('--scenario');
const turnsAt = process.argv.indexOf('--max-turns');
const scenario = scenarioAt >= 0 ? process.argv[scenarioAt + 1] : 'converge';
const maxTurns = turnsAt >= 0 ? Number(process.argv[turnsAt + 1]) : 5;

try {
  console.log(JSON.stringify(runBoundedLoop(scenario, maxTurns), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
