from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


ENCODINGS = ("utf-8-sig", "utf-8", "gb18030")
DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y%m",
    "%Y-%m",
)
MISSING_TOKENS = {"", "na", "n/a", "nan", "null", "none"}
POLLUTANTS = ("PM2.5", "PM10", "SO2", "NO2", "CO", "O3")


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _is_missing(value: object) -> bool:
    return value is None or str(value).strip().lower() in MISSING_TOKENS


def _read_rows(path: Path) -> tuple[str, list[str], list[dict[str, str]]]:
    last_error: UnicodeDecodeError | None = None
    for encoding in ENCODINGS:
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                reader = csv.DictReader(handle)
                headers = list(reader.fieldnames or [])
                rows = [dict(row) for row in reader]
            return encoding, headers, rows
        except UnicodeDecodeError as error:
            last_error = error
    raise ValueError(f"unsupported_encoding:{last_error}")


def _parse_number(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def _parse_date(value: str) -> datetime | None:
    for pattern in DATE_FORMATS:
        try:
            return datetime.strptime(value, pattern)
        except ValueError:
            continue
    return None


def _format_datetime(value: datetime, *, include_time: bool) -> str:
    return value.isoformat(sep=" ") if include_time else value.date().isoformat()


def _infer(values: list[str]) -> str:
    present = [value.strip() for value in values if not _is_missing(value)]
    if not present:
        return "empty"
    if all(value.lstrip("+-").isdigit() for value in present):
        return "integer"
    if all(_parse_number(value) is not None for value in present):
        return "number"
    if all(_parse_date(value) is not None for value in present):
        return "date"
    return "text"


def profile_file(input_path: str | Path, allowed_root: str | Path) -> dict[str, Any]:
    root = Path(allowed_root).resolve()
    path = Path(input_path).resolve()
    if not root.is_dir():
        raise ValueError("allowed_root_missing")
    if not _inside(path, root):
        raise ValueError("input_outside_allowed_root")
    if path.suffix.lower() != ".csv":
        raise ValueError("input_must_be_csv")
    if not path.is_file():
        raise ValueError("input_missing")

    before = path.stat()
    encoding, headers, rows = _read_rows(path)
    after = path.stat()
    if not headers:
        raise ValueError("missing_header")

    values = {header: [str(row.get(header, "") or "") for row in rows] for header in headers}
    row_keys = [tuple(row.get(header, "") for header in headers) for row in rows]
    counts = Counter(row_keys)
    types = {header: _infer(column) for header, column in values.items()}
    date_ranges: dict[str, dict[str, str]] = {}
    for header, inferred in types.items():
        if inferred != "date":
            continue
        parsed = [_parse_date(value.strip()) for value in values[header] if not _is_missing(value)]
        safe = [value for value in parsed if value is not None]
        if safe:
            include_time = any(":" in value for value in values[header] if not _is_missing(value))
            date_ranges[header] = {
                "min": _format_datetime(min(safe), include_time=include_time),
                "max": _format_datetime(max(safe), include_time=include_time),
            }

    nulls = {
        header: sum(1 for value in column if _is_missing(value))
        for header, column in values.items()
    }
    pollutants: dict[str, dict[str, int | float | bool]] = {}
    for field in POLLUTANTS:
        present = field in values
        missing = nulls.get(field, len(rows))
        pollutants[field] = {
            "field_present": present,
            "missing_count": missing,
            "missing_rate": round(missing / len(rows), 6) if rows else 0.0,
        }

    warnings: list[str] = []
    if not rows:
        warnings.append("no_data_rows")
    if len(set(headers)) != len(headers):
        warnings.append("duplicate_headers")
    present_pollutants = [field for field in POLLUTANTS if field in headers]
    missing_fields = [field for field in POLLUTANTS if field not in headers]
    if present_pollutants and missing_fields:
        warnings.append("missing_pollutant_fields:" + ",".join(missing_fields))

    return {
        "schema_version": "1.0",
        "status": "complete",
        "file": {
            "path": str(path),
            "encoding": encoding,
            "bytes": before.st_size,
        },
        "read_boundary": {
            "allowed_root": str(root),
            "mode": "read-only-full-scan",
            "source_write_performed": False,
            "source_stat_unchanged": (
                before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns
            ),
            "missing_tokens": sorted(MISSING_TOKENS),
        },
        "rows": len(rows),
        "column_count": len(headers),
        "columns": headers,
        "types": types,
        "nulls": nulls,
        "exact_duplicates": sum(count - 1 for count in counts.values() if count > 1),
        "date_ranges": date_ranges,
        "pollutants": pollutants,
        "warnings": warnings,
    }


def render_markdown(profile: dict[str, Any]) -> str:
    file_info = profile["file"]
    boundary = profile["read_boundary"]
    date_ranges = profile["date_ranges"]
    observed = date_ranges.get("observed_at")
    if observed is None and date_ranges:
        first_name = sorted(date_ranges)[0]
        observed = date_ranges[first_name]
        time_label = first_name
    else:
        time_label = "observed_at"

    lines = [
        "# 数据体检",
        "",
        f"- 文件：`{file_info['path']}`",
        f"- 编码：`{file_info['encoding']}`",
        f"- 读取边界：`{boundary['mode']}`；允许根目录 `{boundary['allowed_root']}`",
        f"- 源文件写入：未执行；读取前后状态一致：{'是' if boundary['source_stat_unchanged'] else '否'}",
        "",
        "## 规模与时间",
        "",
        f"- 行数：{profile['rows']:,}",
        f"- 列数：{profile['column_count']}",
    ]
    if observed:
        lines.append(f"- 时间范围（`{time_label}`）：{observed['min']} 至 {observed['max']}")
    else:
        lines.append("- 时间范围：未识别到可完整解析的日期列")

    lines.extend(
        [
            "",
            "## 六项污染物缺失",
            "",
            "| 字段 | 是否存在 | 缺失数 | 缺失率 |",
            "|---|---:|---:|---:|",
        ]
    )
    for field in POLLUTANTS:
        item = profile["pollutants"][field]
        lines.append(
            f"| {field} | {'是' if item['field_present'] else '否'} | "
            f"{item['missing_count']:,} | {item['missing_rate']:.2%} |"
        )

    lines.extend(
        [
            "",
            "## 质量提示",
            "",
            f"- 完全重复行：{profile['exact_duplicates']:,}",
        ]
    )
    if profile["warnings"]:
        lines.extend(f"- `{warning}`" for warning in profile["warnings"])
    else:
        lines.append("- 未触发结构级警告。缺失仍需按业务口径判断，不自动填补或删除。")
    return "\n".join(lines) + "\n"


def _write_text(path_value: str | None, content: str, input_path: Path) -> Path | None:
    if not path_value:
        return None
    target = Path(path_value).resolve()
    if target == input_path:
        raise ValueError("output_must_not_overwrite_input")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Profile an allowlisted CSV deterministically.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--json-output")
    parser.add_argument("--markdown-output")
    args = parser.parse_args()
    try:
        result = profile_file(args.input, args.allowed_root)
        input_path = Path(args.input).resolve()
        json_text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        json_path = _write_text(args.json_output, json_text, input_path)
        markdown_path = _write_text(args.markdown_output, render_markdown(result), input_path)
    except (OSError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2

    if json_path or markdown_path:
        print(
            json.dumps(
                {
                    "status": "complete",
                    "rows": result["rows"],
                    "column_count": result["column_count"],
                    "json_output": str(json_path) if json_path else None,
                    "markdown_output": str(markdown_path) if markdown_path else None,
                },
                ensure_ascii=False,
            )
        )
    else:
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
