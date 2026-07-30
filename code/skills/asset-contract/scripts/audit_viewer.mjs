import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function auditViewer(viewerPath) {
  const root = path.resolve(viewerPath);
  const required = ["index.html", "package.json", "viewer-contract.json", "public/model.glb", "src/main.js", "src/style.css"];
  const checks = required.map((file) => ({ code: `file:${file}`, passed: fs.existsSync(path.join(root, file)), detail: file }));
  if (checks.some((check) => !check.passed)) return { status: "blocked", checks };
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const contract = JSON.parse(fs.readFileSync(path.join(root, "viewer-contract.json"), "utf8"));
  const source = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
  const record = (code, passed, detail) => checks.push({ code, passed, detail });
  record("three-version", pkg.dependencies?.three === "0.178.0", pkg.dependencies?.three);
  record("gltf-loader", source.includes("GLTFLoader") && source.includes('loader.load('), "GLTFLoader local model path");
  record("orbit-controls", source.includes("OrbitControls"), "interactive camera controls");
  record("render-loop", source.includes("setAnimationLoop"), "Three.js render loop");
  record("provider-boundary", contract.provider_generation_status === "blocked-not-verified", contract.provider_generation_status);
  record("local-fixture", contract.asset?.is_provider_output === false, contract.asset?.path);
  record("asset-hash", /^[a-f0-9]{64}$/.test(contract.asset?.sha256 ?? ""), contract.asset?.sha256);
  return { status: checks.every((check) => check.passed) ? "passed" : "blocked", checks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditViewer(process.argv[2] ?? ".");
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "passed" ? 0 : 2;
}
