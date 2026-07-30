import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditProject } from "../scripts/audit_game_contract.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(skillRoot, "examples", "beijing-clean-dispatch");

test("generated game passes the static runtime contract", () => {
  const result = auditProject(example);
  assert.equal(result.status, "passed", JSON.stringify(result.checks.filter((check) => !check.passed)));
});

test("game contract records required lifecycle and provenance", () => {
  const contract = JSON.parse(fs.readFileSync(path.join(example, "game-contract.json"), "utf8"));
  assert.deepEqual(contract.states, ["ready", "playing", "complete", "restarted"]);
  assert.equal(contract.countdown_seconds, 45);
  assert.match(contract.source.sha256, /^[a-f0-9]{64}$/);
  assert.match(contract.health_boundary, /不提供健康建议/);
});

test("game source implements visible play mechanics", () => {
  const main = fs.readFileSync(path.join(example, "src", "main.js"), "utf8");
  for (const token of ["movePlayer", "score +=", "remainingSeconds -=", "restartGame", "app.ticker.add"]) {
    assert.ok(main.includes(token), `missing ${token}`);
  }
});
