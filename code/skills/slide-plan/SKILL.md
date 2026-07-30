---
name: slide-plan
description: Convert structured Markdown into an editable PowerPoint deck with title, section, content, data-table, and graphic-placeholder slides, speaker notes, a machine-readable slide plan, and a PowerPoint-free structural audit. Use when Codex must create a local PPTX from Markdown or verify page titles, notes, placeholder contracts, and blank-slide absence.
---

# Slide plan

1. Keep the Markdown hierarchy and audience-facing copy intact.
2. Run the builder to create `slide-plan.json` and an editable PPTX.
3. Give every slide a title, speaker notes, and a `[Sources]` block.
4. Keep tables editable and name table and graphic-placeholder objects according to the plan contract.
5. Run the structural auditor and stop if any slide is blank or lacks a title, notes, or expected placeholder.

```powershell
$node = "<bundled-node.exe>"
$setup = "<presentations-skill>/container_tools/setup_artifact_tool_workspace.mjs"
$env:HOME = $env:USERPROFILE
& $node $setup --workspace <D-drive-temp-workspace>

& $node scripts/build_deck.mjs `
  --workspace <D-drive-temp-workspace> `
  --input <outline.md> `
  --allowed-root <outline-root> `
  --plan-output <output>/slide-plan.json `
  --pptx-output <output>/presentation.pptx `
  --render-dir <output>/rendered `
  --qa-output <output>/visual-qa.json

python -B scripts/audit_pptx.py `
  --input <output>/presentation.pptx `
  --plan <output>/slide-plan.json `
  --report-output <output>/structure-audit.json
```

Read [references/output-contract.md](references/output-contract.md) for Markdown directives and audit rules. The builder uses `@oai/artifact-tool`, renders every slide, and exports editable PowerPoint objects. The structural auditor requires no PowerPoint installation.
