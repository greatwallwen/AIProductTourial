import { readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const apply = process.argv.includes("--apply");
const mapPath = join(root, "rules", "migration-map.json");
const map = JSON.parse(await readFile(mapPath, "utf8"));
const business = new Map(
  map.business_cases
    .filter((item) => item.legacy_runtime_id)
    .map((item) => [item.legacy_runtime_id, item.canonical_id]),
);
const tokenMap = new Map();
for (const item of [...map.prompt, ...map.agent_skills, ...map.loops]) {
  tokenMap.set(item.legacy_id, item.canonical_id);
}
for (const item of map.business_cases.filter((item) => item.legacy_teaching_id)) {
  tokenMap.set(item.legacy_teaching_id, item.canonical_id);
}
const unitMap = new Map(map.prompt_aliases.map((item) => [item.legacy_unit, item.canonical_id]));

const skippedDirs = new Set([".git", ".next", "node_modules", "evidence", "outputs"]);
const textExtensions = new Set([
  ".md", ".json", ".jsonl", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".py",
  ".ps1", ".bat", ".sh", ".svg", ".txt", ".yaml", ".yml", ".toml", ".html", ".css",
  ".csv", ".sha256", ".ndjson",
]);
const changedFiles = [];
const renamedPaths = [];

function canonicalBusiness(id) {
  const canonical = business.get(id);
  if (!canonical) throw new Error(`Unknown business id: ${id}`);
  return canonical;
}

function replaceTokens(text) {
  let next = text;
  for (const [legacy, canonical] of unitMap) {
    next = next.replace(new RegExp(`\\b${legacy}(?!\\d)`, "gu"), canonical);
  }
  for (const [legacy, canonical] of tokenMap) {
    next = next.replace(new RegExp(`\\b${legacy}(?!\\d)`, "gu"), canonical);
  }
  next = next.replace(/\b(dataset|code\/cases)\/(0[1-9]|1[0-9]|20)-/gu, (_, prefix, id) => `${prefix}/${canonicalBusiness(id)}-`);
  next = next.replace(/\bcase-(0[1-9]|1[0-9]|20)(?=[/\\"'`.:-]|$)/gu, (_, id) => `case-${canonicalBusiness(id)}`);
  next = next.replace(/\/(api\/)?cases\/(0[1-9]|1[0-9]|20)(?=[/\\"'`?#]|$)/gu, (_, api = "", id) => `/${api}cases/${canonicalBusiness(id)}`);
  next = next.replace(/datasetFolder:\s*(["'])(0[1-9]|1[0-9]|20)-/gu, (_, quote, id) => `datasetFolder: ${quote}${canonicalBusiness(id)}-`);
  next = next.replace(/featuredObjectId:\s*(["'])(0[1-9]|1[0-9]|20)-/gu, (_, quote, id) => `featuredObjectId: ${quote}${canonicalBusiness(id)}-`);
  next = next.replace(/(["'`])(0[1-9]|1[0-9]|20)-(?=[A-Z])/gu, (_, quote, id) => `${quote}${canonicalBusiness(id)}-`);
  return next;
}

function replaceRuntimeIds(text, relativePath) {
  let next = text;
  const normalized = relativePath.split(sep).join("/");
  const broadRuntimeFile =
    normalized.startsWith("code/cases/") ||
    normalized.startsWith("code/case-runtime/") ||
    normalized === "dataset/manifest.json";

  if (broadRuntimeFile) {
    next = next.replace(/(["'])(0[1-9]|1[0-9]|20)\1/gu, (match, quote, id, offset, whole) => {
      const before = whole.slice(Math.max(0, offset - 32), offset);
      const after = whole.slice(offset + match.length, offset + match.length + 16);
      if (/\b(?:caseId|case_id|\bid|definition\.id|workflows|LIVE_CASES|getCaseDefinition|store\.(?:seed|project|listEvents|latestReceipt|resetObject))\s*[:=(,[\s]*$/u.test(before) || /^\s*[:,\])]/u.test(after)) {
        return `${quote}${canonicalBusiness(id)}${quote}`;
      }
      return match;
    });
  }

  next = next.replace(/(caseId\s*[:=]\s*|case_id["']?\s*:\s*|getCaseDefinition\(\s*|definition\.id\s*===\s*|caseId\s*===\s*|runtimeId\s*===\s*)(["'])(0[1-9]|1[0-9]|20)\2/gu,
    (_, prefix, quote, id) => `${prefix}${quote}${canonicalBusiness(id)}${quote}`,
  );
  next = next.replace(/(["'])(0[1-9]|1[0-9]|20)\1\s*:/gu, (_, quote, id) => `${quote}${canonicalBusiness(id)}${quote}:`);
  return next;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = relative(root, path);
    if (rel === join("rules", "migration-map.json") || !textExtensions.has(extname(entry.name).toLowerCase())) continue;
    const source = await readFile(path, "utf8");
    const transformed = replaceRuntimeIds(replaceTokens(source), rel);
    if (transformed !== source) {
      changedFiles.push(rel);
      if (apply) await writeFile(path, transformed, "utf8");
    }
  }
}

function renamedName(name, parentPath, isDirectory) {
  let next = name;
  const parent = relative(root, parentPath).split(sep).join("/");
  if (isDirectory && (parent === "code/cases" || parent === "dataset")) {
    next = next.replace(/^(0[1-9]|1[0-9]|20)-/u, (_, id) => `${canonicalBusiness(id)}-`);
  }
  if (isDirectory && parent === "assets/cases") {
    next = next.replace(/^case-(0[1-9]|1[0-9]|20)$/u, (_, id) => `case-${canonicalBusiness(id)}`);
  }
  next = next.replace(/\b([BPSL])(0[1-9]|1[0-9]|20)(?!\d)/gu, (_, kind, id) => `${kind}${id.padStart(3, "0")}`);
  if (!isDirectory && (parent === "code/app/tests" || parent === "sources/cards")) {
    next = next.replace(/^case-(0[1-9]|1[0-9]|20)-/u, (_, id) => `case-${canonicalBusiness(id)}-`);
  }
  return next;
}

async function collectRenameCandidates(dir, result = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collectRenameCandidates(path, result);
    const nextName = renamedName(entry.name, dir, entry.isDirectory());
    if (nextName !== entry.name) result.push({ path, nextPath: join(dir, nextName) });
  }
  return result;
}

await walk(root);
const candidates = (await collectRenameCandidates(root)).sort((a, b) => b.path.length - a.path.length);
for (const item of candidates) {
  const currentExists = await stat(item.path).then(() => true, () => false);
  if (!currentExists) continue;
  const targetExists = await stat(item.nextPath).then(() => true, () => false);
  if (targetExists) throw new Error(`Rename target already exists: ${relative(root, item.nextPath)}`);
  renamedPaths.push({ from: relative(root, item.path), to: relative(root, item.nextPath) });
  if (apply) await rename(item.path, item.nextPath);
}

const courseManifestPath = join(root, "course-manifest.json");
if (apply) {
  const manifest = JSON.parse(await readFile(courseManifestPath, "utf8"));
  manifest.schema_version = "6.0";
  manifest.case_id_policy = {
    canonical_pattern: "P/S/L/B + three digits",
    business_case_ids: "B001-B024",
    display_order_field: "display_order",
    legacy_routes: "redirect_only",
    rule: "清单、目录、API、状态与公开路由使用同一个三位主编号；排序不写入编号。",
  };
  manifest.teaching_spine.prompt_units = ["P001", "P002", "P003", "P005", "P006", "P008"];
  manifest.cases.forEach((item, index) => {
    if (/^\d{2}$/u.test(item.id)) item.id = canonicalBusiness(item.id);
    item.display_order = index + 1;
  });
  manifest.runtime.provider.live_case_ids = manifest.runtime.provider.live_case_ids.map((id) =>
    /^\d{2}$/u.test(id) ? canonicalBusiness(id) : id,
  );
  manifest.labs.forEach((item) => { item.display_order = Number(item.id.slice(1)); });
  await writeFile(courseManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const datasetManifestPath = join(root, "dataset", "manifest.json");
  const datasetManifest = JSON.parse(await readFile(datasetManifestPath, "utf8"));
  datasetManifest.schema_version = "7.0";
  datasetManifest.datasets.forEach((item) => {
    if (/^\d{2}$/u.test(item.case_id)) item.case_id = canonicalBusiness(item.case_id);
    if (/^B\d{3}$/u.test(item.case_id)) item.display_order = Number(item.case_id.slice(1));
  });
  await writeFile(datasetManifestPath, `${JSON.stringify(datasetManifest, null, 2)}\n`, "utf8");
}

const receipt = {
  schema_version: "1.0",
  mode: apply ? "apply" : "dry-run",
  root,
  changed_file_count: changedFiles.length,
  renamed_path_count: renamedPaths.length,
  changed_files: changedFiles.sort(),
  renamed_paths: renamedPaths,
};
if (apply) {
  await writeFile(
    join(root, "evidence", "maintenance", "canonical-id-migration-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
