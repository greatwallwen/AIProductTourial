# Member brief output contract

`metrics.json` uses `schema_version: "1.0"` and contains the source hash and read boundary, CNY parameters, source columns, limitations, and a metric list. Each metric records status, formula, filters, unit, calculation ID, basis, and limitation.

`business-brief.md` renders the same evidence in four sections: facts, interpretation, next steps, and limitations. The machine-readable JSON retains calculation IDs; the human brief omits those opaque identifiers and keeps the formula meaning in plain language. Scenario budget is labelled as a nominal coupon-face-value ceiling, not observed spend.

Example calculated metric:

```json
{
  "metric_id": "target_full_issue_budget",
  "status": "calculated",
  "value": 10000.0,
  "unit": "CNY",
  "formula": "target_segment_members * coupon_amount_cny",
  "basis": "scenario",
  "limitation": "This is not observed redemption cost."
}
```

Example unavailable metric:

```json
{
  "metric_id": "historical_revenue",
  "status": "not_calculable",
  "value": null,
  "unit": null,
  "limitation": "The source has no transaction amount."
}
```
