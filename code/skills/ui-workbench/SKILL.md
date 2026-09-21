---
name: ui-workbench
description: Turn operational workflow contracts and tabular case data into accessible, responsive workbench interfaces with explicit states, evidence boundaries, action gates, and browser verification. Use when building or evaluating admin consoles, review queues, case-management tools, approval desks, or Prompt-versus-Skill-versus-UI-Kit comparisons.
---

# UI Workbench

Convert a business workflow into a quiet, task-focused interface whose states and actions can be checked.

## Workflow

1. Read the business contract, source schema, representative record, and prohibited claims.
2. Separate observed facts, missing evidence, allowed conclusions, and available actions.
3. Define the page regions before styling: queue, selected record, evidence, decision controls, and completion gate.
4. Define all required states: empty, selected, loading or busy, validation error, pending, explicit result, disabled, and completed.
5. Keep one canonical content and interaction contract when comparing visual systems.
6. Use native controls and landmarks first. Preserve labels, focus visibility, keyboard order, and live status updates.
7. Verify desktop and phone layouts, keyboard access, state transitions, text overflow, console errors, and horizontal overflow.
8. Record data source, generated output, screenshots, checks, limitations, and any external UI Kit separately.

## Guardrails

- Do not invent personal data, external results, evidence, approval, or completion.
- Do not turn an allegation into a verified fact.
- Do not make a destructive or irreversible action the default button.
- Do not call a component library a Skill. A UI Kit supplies components; this Skill supplies workflow and acceptance rules.
- Do not score a Prompt-only group as if a page was generated.
- Keep operational pages dense and scannable; avoid marketing heroes and decorative card grids.

## Local Comparison

Run the deterministic B10 comparison:

```bash
python3 -B code/skills/ui-workbench/scripts/build_ui_comparison.py \
  --input dataset/10-telecom-complaint-orchestration/case.csv \
  --allowed-root dataset/10-telecom-complaint-orchestration \
  --tabler-css vendor/tabler/1.4.0/tabler.min.css \
  --output-dir assets/S10
```

Read [references/acceptance-contract.md](references/acceptance-contract.md) before changing the workflow or evaluation criteria.
