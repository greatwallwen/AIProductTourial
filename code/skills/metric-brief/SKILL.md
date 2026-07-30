---
name: metric-brief
description: Calculate traceable member-operation metrics from an approved CSV and produce a one-page Chinese brief that separates facts, interpretations, next actions, and unavailable metrics. Use after data profiling when a user requests a member experiment, coupon targeting analysis, metric summary, or evidence-linked operating brief.
---

# Metric brief

1. Confirm that the CSV is inside the caller-approved data root and has already been profiled.
2. Run the deterministic member-brief script with an explicit coupon amount and target segment.
3. Check every calculated metric for formula, filters, unit, calculation ID, and limitation.
4. Keep observed facts, interpretations, and next actions separate.
5. Preserve `not_calculable` metrics; never invent missing time or monetary fields.

```powershell
python -B scripts/build_member_brief.py `
  --input <csv> `
  --allowed-root <data-root> `
  --coupon-amount-cny 8 `
  --target-segment 成长 `
  --metrics-output <output>/metrics.json `
  --brief-output <output>/business-brief.md
```

Read [references/output-contract.md](references/output-contract.md) when validating the outputs. Read [references/metric-contract.md](references/metric-contract.md) before changing formulas or adding a metric.
