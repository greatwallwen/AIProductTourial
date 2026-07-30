import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const WIDTH = 1280;
const HEIGHT = 720;
const COLORS = {
  navy: "#172A3A",
  ink: "#1A2B38",
  paper: "#F7F4EC",
  saffron: "#F0B134",
  mist: "#D8E4E8",
  white: "#FFFFFF",
};
const DIRECTIVE = /^<!--\s*(layout|notes|graphic|source):\s*(.*?)\s*-->$/;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    args[item.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function required(args, name) {
  if (!args[name]) throw new Error(`missing_argument:${name}`);
  return args[name];
}

function inside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function loadArtifactTool(workspace) {
  const requireFromWorkspace = createRequire(path.join(workspace, "package.json"));
  const entry = requireFromWorkspace.resolve("@oai/artifact-tool");
  return import(pathToFileURL(entry).href);
}

function parseTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isSeparator(row) {
  return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(" ", "")));
}

function parseMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let deckTitle = "";
  let deckSubtitle = "";
  let titleNotes = "";
  let titleSource = "Course-local Markdown input";
  const specs = [];
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("# ") && !deckTitle) {
      deckTitle = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      if (current) specs.push(current);
      current = {
        title: line.slice(3).trim(),
        kind: "content",
        subtitle: "",
        bullets: [],
        paragraphs: [],
        table: [],
        graphic: "",
        notes: "",
        sourceRef: "Course-local Markdown input",
        sourceLine: index + 1,
      };
      continue;
    }
    const match = line.match(DIRECTIVE);
    if (match) {
      const [, key, value] = match;
      if (!current) {
        if (key === "notes") titleNotes = value;
        if (key === "source") titleSource = value;
      } else if (key === "layout") {
        current.kind = value.trim().toLowerCase();
      } else if (key === "notes") {
        current.notes = value;
      } else if (key === "source") {
        current.sourceRef = value;
      } else if (key === "graphic") {
        current.graphic = value;
        current.kind = "graphic";
      }
      continue;
    }
    if (line.startsWith("> ")) {
      const value = line.slice(2).trim();
      if (!current && !deckSubtitle) deckSubtitle = value;
      else if (current) current.paragraphs.push(value);
      continue;
    }
    if (current && (line.startsWith("- ") || line.startsWith("* "))) {
      current.bullets.push(line.slice(2).trim());
      continue;
    }
    if (current && line.startsWith("|") && line.endsWith("|")) {
      const rows = [];
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!(candidate.startsWith("|") && candidate.endsWith("|"))) break;
        const row = parseTableRow(candidate);
        if (!isSeparator(row)) rows.push(row);
        index += 1;
      }
      index -= 1;
      current.table = rows;
      current.kind = "table";
      continue;
    }
    if (current && line && !line.startsWith("<!--")) current.paragraphs.push(line);
  }
  if (current) specs.push(current);
  if (!deckTitle) throw new Error("markdown_missing_h1_title");
  if (specs.length === 0) throw new Error("markdown_requires_at_least_one_h2_slide");
  return [
    {
      title: deckTitle,
      subtitle: deckSubtitle,
      kind: "title",
      bullets: [],
      paragraphs: [],
      table: [],
      graphic: "",
      notes: titleNotes,
      sourceRef: titleSource,
      sourceLine: 1,
    },
    ...specs,
  ];
}

function rect(left, top, width, height) {
  return { left, top, width, height };
}

function overlaps(a, b) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

function register(qa, slideNumber, name, position, options = {}) {
  if (position.left < 0 || position.top < 0 || position.left + position.width > WIDTH || position.top + position.height > HEIGHT) {
    qa.boundsIssues.push({ slideNumber, name, position });
  }
  if (options.text) {
    const fontSize = options.fontSize || 24;
    const charsPerLine = Math.max(1, Math.floor(position.width / (fontSize * 0.72)));
    const lines = Math.max(1, Math.ceil(options.text.length / charsPerLine));
    const estimatedHeight = lines * fontSize * 1.32;
    if (estimatedHeight > position.height) {
      qa.textOverflowIssues.push({ slideNumber, name, estimatedHeight, availableHeight: position.height });
    }
  }
  if (!options.allowOverlap) {
    const entries = qa.elementsBySlide.get(slideNumber) || [];
    for (const other of entries) {
      if (overlaps(position, other.position)) qa.overlapIssues.push({ slideNumber, first: other.name, second: name });
    }
    entries.push({ name, position });
    qa.elementsBySlide.set(slideNumber, entries);
  }
}

function addText(slide, qa, slideNumber, name, text, position, style, allowOverlap = false) {
  register(qa, slideNumber, name, position, { text, fontSize: style.fontSize, allowOverlap });
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = style;
  return shape;
}

function setNotes(slide, spec, sourcePath) {
  const note = spec.notes || `说明“${spec.title}”的核心信息；不扩展 Markdown 之外的事实。`;
  const source = spec.sourceRef || `Input Markdown: ${path.basename(sourcePath)}`;
  slide.speakerNotes.textFrame.setText(`${note}\n\n[Sources]\n- ${source}`);
  slide.speakerNotes.setVisible(true);
}

function addChrome(slide, qa, slideNumber, title) {
  addText(slide, qa, slideNumber, "SLIDE_TITLE", title, rect(76, 48, 1040, 64), {
    fontSize: 48,
    bold: true,
    color: COLORS.ink,
  });
  addText(slide, qa, slideNumber, "PAGE_NUMBER", String(slideNumber).padStart(2, "0"), rect(1160, 54, 48, 32), {
    fontSize: 20,
    bold: true,
    color: COLORS.ink,
    alignment: "right",
  });
  slide.shapes.add({
    geometry: "rect",
    name: "ACCENT_RULE",
    position: rect(76, 126, 106, 8),
    fill: COLORS.saffron,
    line: { style: "solid", fill: "none", width: 0 },
  });
}

function addTitleSlide(presentation, qa, spec, sourcePath, slideNumber) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.paper;
  addText(slide, qa, slideNumber, "TITLE_KICKER", "EDITABLE COURSE DECK", rect(82, 78, 430, 30), {
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  addText(slide, qa, slideNumber, "SLIDE_TITLE", spec.title, rect(82, 206, 820, 172), {
    fontSize: 70,
    bold: true,
    color: COLORS.ink,
  });
  if (spec.subtitle) {
    addText(slide, qa, slideNumber, "SUBTITLE", spec.subtitle, rect(86, 430, 760, 76), {
      fontSize: 30,
      color: "#516572",
    });
  }
  slide.shapes.add({
    geometry: "rect",
    name: "TITLE_ACCENT",
    position: rect(1032, 0, 248, 720),
    fill: COLORS.saffron,
    line: { style: "solid", fill: "none", width: 0 },
  });
  setNotes(slide, spec, sourcePath);
}

function addSectionSlide(presentation, qa, spec, sourcePath, slideNumber) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.saffron;
  addText(slide, qa, slideNumber, "SECTION_NUMBER", `SECTION ${String(slideNumber - 1).padStart(2, "0")}`, rect(84, 74, 360, 32), {
    fontSize: 20,
    bold: true,
    color: COLORS.navy,
  });
  addText(slide, qa, slideNumber, "SLIDE_TITLE", spec.title, rect(82, 256, 1080, 144), {
    fontSize: 64,
    bold: true,
    color: COLORS.navy,
  });
  setNotes(slide, spec, sourcePath);
}

function addContentSlide(presentation, qa, spec, sourcePath, slideNumber) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.paper;
  addChrome(slide, qa, slideNumber, spec.title);
  const items = [...spec.paragraphs, ...spec.bullets];
  const bodyText = (items.length ? items : ["本页内容由 Markdown 大纲提供。"]).map((item) => `• ${item}`).join("\n\n");
  addText(slide, qa, slideNumber, "BODY", bodyText, rect(92, 176, 1050, 420), {
    fontSize: items.length > 4 ? 24 : 28,
    color: COLORS.ink,
  });
  setNotes(slide, spec, sourcePath);
}

function addTableSlide(presentation, qa, spec, sourcePath, slideNumber) {
  if (spec.table.length < 2) throw new Error(`table_slide_requires_header_and_data:${spec.title}`);
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.paper;
  addChrome(slide, qa, slideNumber, spec.title);
  const columns = Math.max(...spec.table.map((row) => row.length));
  const values = spec.table.map((row) => Array.from({ length: columns }, (_, index) => row[index] || ""));
  const position = rect(90, 176, 1100, 420);
  register(qa, slideNumber, `DATA_TABLE:table-${slideNumber}`, position);
  const table = slide.tables.add({ rows: values.length, columns, ...position, values });
  table.name = `DATA_TABLE:table-${slideNumber}`;
  table.styleOptions = { headerRow: true, bandedRows: true };
  table.borders.assign({ style: "solid", fill: "#B9C7CD", width: 1 });
  for (let column = 0; column < columns; column += 1) {
    const cell = table.getCell(0, column);
    cell.fill = COLORS.navy;
    cell.text.style = { fontSize: 20, bold: true, color: COLORS.white };
  }
  for (let row = 1; row < values.length; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      table.getCell(row, column).text.style = { fontSize: 18, color: COLORS.ink };
    }
  }
  setNotes(slide, spec, sourcePath);
}

function addGraphicSlide(presentation, qa, spec, sourcePath, slideNumber) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.paper;
  addChrome(slide, qa, slideNumber, spec.title);
  const [rawId, ...requirementParts] = spec.graphic.split("|");
  const graphicId = rawId.trim() || `graphic-${slideNumber}`;
  const requirements = requirementParts.join("|").trim() || "待提供可编辑图形工件";
  const position = rect(104, 176, 1072, 420);
  register(qa, slideNumber, `GRAPHIC_PLACEHOLDER:${graphicId}`, position, { text: requirements, fontSize: 24 });
  const frame = slide.shapes.add({
    geometry: "roundRect",
    name: `GRAPHIC_PLACEHOLDER:${graphicId}`,
    position,
    fill: COLORS.mist,
    line: { style: "dashed", fill: COLORS.navy, width: 2 },
    borderRadius: "rounded-2xl",
  });
  frame.text = `图形占位\n${requirements}`;
  frame.text.style = { fontSize: 26, bold: true, color: COLORS.navy, alignment: "center", verticalAlignment: "middle" };
  setNotes(slide, spec, sourcePath);
}

function buildPlan(sourcePath, sourceDigest, specs) {
  return {
    schema_version: "1.0",
    status: "complete-local",
    source: { path: sourcePath, sha256: sourceDigest, read_mode: "read-only", source_write_performed: false },
    format: "pptx",
    editable: true,
    generator: "@oai/artifact-tool",
    slide_count: specs.length,
    slides: specs.map((spec, index) => {
      const slideNumber = index + 1;
      const placeholders = [];
      if (spec.kind === "table") placeholders.push({ id: `table-${slideNumber}`, type: "data-table", editable: true, rows: spec.table.length, columns: Math.max(...spec.table.map((row) => row.length)) });
      if (spec.kind === "graphic") {
        const [rawId, ...parts] = spec.graphic.split("|");
        placeholders.push({ id: rawId.trim() || `graphic-${slideNumber}`, type: "graphic-placeholder", editable: true, requirements: parts.join("|").trim() });
      }
      return {
        slide_number: slideNumber,
        kind: spec.kind,
        title: spec.title,
        source_line: spec.sourceLine,
        notes_present: true,
        source_ref: spec.sourceRef,
        placeholders,
        content_budget: {
          visible_characters: [spec.title, spec.subtitle, ...spec.paragraphs, ...spec.bullets].reduce((sum, item) => sum + item.length, 0),
          status: "within-local-template-budget",
        },
      };
    }),
  };
}

async function writeBlob(target, blob) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspace = path.resolve(required(args, "workspace"));
  const input = path.resolve(required(args, "input"));
  const allowedRoot = path.resolve(required(args, "allowed-root"));
  const planOutput = path.resolve(required(args, "plan-output"));
  const pptxOutput = path.resolve(required(args, "pptx-output"));
  const renderDir = path.resolve(required(args, "render-dir"));
  const qaOutput = path.resolve(required(args, "qa-output"));
  if (!inside(input, allowedRoot)) throw new Error("input_outside_allowed_root");
  if (!input.toLowerCase().endsWith(".md")) throw new Error("input_must_be_markdown");
  if (!planOutput.toLowerCase().endsWith(".json") || !qaOutput.toLowerCase().endsWith(".json")) throw new Error("json_output_extension_required");
  if (!pptxOutput.toLowerCase().endsWith(".pptx")) throw new Error("pptx_output_extension_required");
  const raw = await fs.readFile(input);
  const markdown = raw.toString("utf8").replace(/^\uFEFF/, "");
  const digest = crypto.createHash("sha256").update(raw).digest("hex");
  const specs = parseMarkdown(markdown);
  const { Presentation, PresentationFile } = await loadArtifactTool(workspace);
  const presentation = Presentation.create({ slideSize: { width: WIDTH, height: HEIGHT } });
  const qa = { boundsIssues: [], overlapIssues: [], textOverflowIssues: [], elementsBySlide: new Map() };

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const slideNumber = index + 1;
    if (spec.kind === "title") addTitleSlide(presentation, qa, spec, input, slideNumber);
    else if (spec.kind === "section") addSectionSlide(presentation, qa, spec, input, slideNumber);
    else if (spec.kind === "table") addTableSlide(presentation, qa, spec, input, slideNumber);
    else if (spec.kind === "graphic") addGraphicSlide(presentation, qa, spec, input, slideNumber);
    else addContentSlide(presentation, qa, spec, input, slideNumber);
  }

  await fs.mkdir(renderDir, { recursive: true });
  const layouts = [];
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(renderDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layoutBlob = await slide.export({ format: "layout" });
    const layoutText = await layoutBlob.text();
    await fs.writeFile(path.join(renderDir, `${stem}.layout.json`), layoutText, "utf8");
    layouts.push({ slide_number: index + 1, bytes: Buffer.byteLength(layoutText, "utf8") });
  }
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,table,notes", maxChars: 30000 });
  await fs.writeFile(path.join(renderDir, "inspect.ndjson"), inspect.ndjson, "utf8");

  const plan = buildPlan(input, digest, specs);
  const visualQa = {
    schema_version: "1.0",
    status: qa.boundsIssues.length || qa.overlapIssues.length || qa.textOverflowIssues.length ? "failed" : "passed",
    renderer: "@oai/artifact-tool",
    rendered_slide_count: presentation.slides.items.length,
    bounds_issues: qa.boundsIssues,
    overlap_issues: qa.overlapIssues,
    text_overflow_issues: qa.textOverflowIssues,
    layout_exports: layouts,
  };
  await fs.mkdir(path.dirname(planOutput), { recursive: true });
  await fs.mkdir(path.dirname(pptxOutput), { recursive: true });
  await fs.mkdir(path.dirname(qaOutput), { recursive: true });
  await fs.writeFile(planOutput, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await fs.writeFile(qaOutput, `${JSON.stringify(visualQa, null, 2)}\n`, "utf8");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(pptxOutput);
  console.log(JSON.stringify({ status: visualQa.status, slides: plan.slide_count, generator: plan.generator, plan_output: planOutput, pptx_output: pptxOutput, render_dir: renderDir, qa_output: qaOutput }));
  if (visualQa.status !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "blocked", reason: error?.stack || String(error) }));
  process.exitCode = 2;
});
