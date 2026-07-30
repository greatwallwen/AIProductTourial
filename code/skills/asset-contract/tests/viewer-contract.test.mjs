import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditViewer } from "../scripts/audit_viewer.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewer = path.join(skillRoot, "examples", "three-viewer");

test("local Three.js viewer passes its static contract", () => {
  const result = auditViewer(viewer);
  assert.equal(result.status, "passed", JSON.stringify(result.checks.filter((check) => !check.passed)));
});

test("viewer explicitly distinguishes local fixture from provider generation", () => {
  const result = auditViewer(viewer);
  const provider = result.checks.find((check) => check.code === "provider-boundary");
  const fixture = result.checks.find((check) => check.code === "local-fixture");
  assert.equal(provider?.passed, true);
  assert.equal(fixture?.passed, true);
});
