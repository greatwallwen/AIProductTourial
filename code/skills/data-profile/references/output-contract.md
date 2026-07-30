# Data profile output contract

`profile.json` uses `schema_version: "1.0"` and contains:

- `file`: resolved path, detected encoding, and byte size;
- `read_boundary`: approved root, read-only full-scan mode, missing tokens, and source-stat check;
- `rows`, `column_count`, and ordered `columns`;
- `types`, `nulls`, `exact_duplicates`, and `date_ranges`;
- `pollutants`: `PM2.5`, `PM10`, `SO2`, `NO2`, `CO`, and `O3`, each with field presence, missing count, and missing rate;
- `warnings`: observed structural conditions only.

`profile.md` is a short Chinese rendering of the same facts. Treat inferred types as proposals: a numeric-looking business identifier can still be text. Missing values are not errors until a field contract says they are required.

Example:

```json
{
  "schema_version": "1.0",
  "status": "complete",
  "rows": 2,
  "column_count": 8,
  "date_ranges": {
    "observed_at": {"min": "2024-01-01 00:00:00", "max": "2024-01-01 01:00:00"}
  },
  "pollutants": {
    "PM2.5": {"field_present": true, "missing_count": 1, "missing_rate": 0.5}
  }
}
```
