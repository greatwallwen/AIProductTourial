---
name: product-opportunity-map
description: Build an editable Chinese SVG product opportunity map and provenance JSON from an allowlisted CSV. Use when customer or workflow evidence must become traceable problem, opportunity, and first-experiment nodes without inventing users, counts, features, or market claims.
---

# Product opportunity map

1. Confirm that the CSV is inside the approved data root.
2. Run `scripts/build_opportunity_map.py`; do not add nodes from chat intuition.
3. Review every node's `source_refs` and `rule_id` in the JSON.
4. Treat the SVG as an editable projection of that JSON. Edit the source or explicit rules, then rerun it.

```powershell
python -B scripts/build_opportunity_map.py `
  --input ../../../dataset/S-agent-skill-cases/case.csv `
  --allowed-root ../../../dataset `
  --json-output examples/opportunity-map.json `
  --svg-output examples/opportunity-map.svg
```

Stop if required S004 rows or source phrases are absent. Never infer sample size, prevalence, solution demand, or causal impact.
