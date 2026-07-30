---
name: data-profile
description: Profile an unfamiliar CSV before analysis and produce deterministic JSON and concise Markdown covering rows, columns, inferred types, nulls, duplicates, date ranges, and, when present, six Beijing air-pollutant missing rates. Use for CSV usability checks, cleaning requests, or analysis tasks whose data quality has not yet been verified.
---

# Data profile

1. Confirm that the CSV is inside the caller-approved data root.
2. Run the deterministic profiler; never estimate counts with a model.
3. Read `profile.json` before proposing cleaning or analysis.
4. Separate observed quality issues from treatment proposals.
5. Stop before changing source rows unless the user explicitly approves a transform.

```powershell
python -B scripts/profile_csv.py `
  --input <csv> `
  --allowed-root <data-root> `
  --json-output <output>/profile.json `
  --markdown-output <output>/profile.md
```

Read [references/output-contract.md](references/output-contract.md) when consuming or validating the JSON. The script reads the entire CSV without writing it and blocks paths outside the approved root.
