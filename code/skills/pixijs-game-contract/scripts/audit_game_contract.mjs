import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function auditProject(projectPath) {
  const root = path.resolve(projectPath);
  const requiredFiles = [
    "index.html", "package.json", "vite.config.js", "game-contract.json",
    "src/main.js", "src/style.css", "src/game-config.js",
  ];
  const checks = [];
  const record = (code, passed, detail) => checks.push({ code, passed, detail });
  for (const file of requiredFiles) {
    record(`file:${file}`, fs.existsSync(path.join(root, file)), file);
  }
  if (checks.some((check) => !check.passed)) return { status: "blocked", checks };

  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const contract = JSON.parse(fs.readFileSync(path.join(root, "game-contract.json"), "utf8"));
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const main = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
  record("pixi-version", pkg.dependencies?.["pixi.js"] === "8.8.1", pkg.dependencies?.["pixi.js"]);
  record("module-entry", index.includes('/src/main.js') && index.includes('type="importmap"'), "browser module entry and import map");
  record("application-init", main.includes("new Application()") && main.includes("await app.init"), "PixiJS v8 async init");
  record("ticker-loop", main.includes("app.ticker.add"), "render/update loop");
  record("keyboard", main.includes("keydown") && main.includes("keyup") && main.includes("KeyR"), "movement and restart keys");
  record("score", main.includes("score += gameConfig.scorePerTicket"), "ticket score update");
  record("countdown", main.includes("remainingSeconds -= seconds"), "ticker countdown");
  record("restart", main.includes("function restartGame()") && main.includes('button_id": "restart"') === false, "restart function");
  record("cleanup", main.includes("app.destroy") && main.includes("pagehide"), "application cleanup");
  record("health-boundary", contract.health_boundary.includes("不提供健康建议"), contract.health_boundary);
  record("source-provenance", /^[a-f0-9]{64}$/.test(contract.source?.sha256 ?? ""), contract.source?.path);
  return { status: checks.every((check) => check.passed) ? "passed" : "blocked", checks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditProject(process.argv[2] ?? ".");
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "passed" ? 0 : 2;
}
