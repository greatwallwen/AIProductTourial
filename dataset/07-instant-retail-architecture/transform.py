"""Rebuild the case-07 public slice and deterministic China operations evidence."""

from __future__ import annotations

import argparse
import csv
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import sys


CASE_DIR = Path(__file__).resolve().parent
FIELDNAMES = [
    "facility_code",
    "facility_label",
    "scenario_date",
    "domain",
    "owner_team",
    "request_count",
    "p95_latency_ms",
    "release_count",
    "incident_minutes",
    "recovery_minutes",
    "data_nature",
]

DOMAINS = [
    ("订单接入", "订单平台组", 2.05, 20, 2, 2, 0, 0),
    ("库存", "库存平台组", 1.975, 35, 3, 1, 1, 12),
    ("履约", "履约平台组", 1.525, 96, 2, 3, 8, 38),
    ("配送交接", "配送平台组", 1.2, 47, 5, 1, 2, 18),
]


def build_operational_evidence() -> int:
    output = CASE_DIR / "operational-evidence.csv"
    benchmark_orders_per_day, benchmark_p90_item_count = load_benchmark_shape()
    rows: list[dict[str, str | int]] = []
    start = date(2026, 7, 1)
    for day_index in range(14):
        scenario_date = (start + timedelta(days=day_index)).isoformat()
        for domain_index, (
            domain,
            owner,
            request_multiplier,
            latency_multiplier,
            latency_offset,
            releases,
            incidents,
            recovery,
        ) in enumerate(DOMAINS):
            requests = round(benchmark_orders_per_day * request_multiplier)
            latency = benchmark_p90_item_count * latency_multiplier + latency_offset
            rows.append(
                {
                    "facility_code": "CN-FC-COURSE-01",
                    "facility_label": "中国前置仓课程场景",
                    "scenario_date": scenario_date,
                    "domain": domain,
                    "owner_team": owner,
                    "request_count": requests + day_index * (137 - domain_index * 11),
                    "p95_latency_ms": latency + ((day_index * 17 + domain_index * 13) % 67),
                    "release_count": releases + (1 if (day_index + domain_index) % 5 == 0 else 0),
                    "incident_minutes": incidents + ((day_index + domain_index) % 4 if incidents else 0),
                    "recovery_minutes": recovery + ((day_index * 3 + domain_index) % 10 if recovery else 0),
                    "data_nature": "deterministic-synthetic-cn-operations",
                }
            )
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def load_benchmark_shape() -> tuple[int, int]:
    """Use only observable case.csv shape as the deterministic scenario anchor."""

    counts_by_day: dict[int, int] = {}
    item_counts: list[int] = []
    with (CASE_DIR / "case.csv").open("r", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            day_index = int(row["day_index"])
            counts_by_day[day_index] = counts_by_day.get(day_index, 0) + 1
            item_counts.append(int(row["item_count"]))
    if not counts_by_day or not item_counts:
        raise ValueError("case.csv must contain benchmark day and item-count facts")
    orders_per_day = round(sum(counts_by_day.values()) / len(counts_by_day))
    item_counts.sort()
    p90_index = max(0, (len(item_counts) * 9 + 9) // 10 - 1)
    return orders_per_day, item_counts[p90_index]


def rebuild_public_slice() -> object:
    sys.path.insert(0, str(CASE_DIR.parents[1] / "tools"))
    from prepare_dataset_cases import run

    return run("07")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_contracts(operational_rows: int) -> None:
    operational_path = CASE_DIR / "operational-evidence.csv"
    operational_hash = sha256(operational_path)

    source_path = CASE_DIR / "source.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    source["sources"] = [item for item in source.get("sources", []) if item.get("id") != "COURSE-OPS-07"]
    source["sources"].append(
        {
            "id": "COURSE-OPS-07",
            "title": "中国前置仓课程运营证据",
            "publisher": "Course_AIProduct",
            "version": "1.0",
            "license": "course-generated",
            "state": "generated-verified",
            "redistribution": "allowed-with-course",
        }
    )
    source["supplemental_outputs"] = [
        {
            "source_id": "COURSE-OPS-07",
            "path": "operational-evidence.csv",
            "rows": operational_rows,
            "sha256": operational_hash,
            "data_nature": "deterministic-synthetic-cn-operations",
            "boundary": "用于架构评审门禁的可复算课程场景，不是企业生产观测或经营结果。",
        }
    ]
    source_path.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    schema_path = CASE_DIR / "schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    schema["supplemental_artifacts"] = [
        {
            "path": "operational-evidence.csv",
            "row_count": operational_rows,
            "data_nature": "deterministic-synthetic-cn-operations",
            "source_ids": ["COURSE-OPS-07"],
            "columns": FIELDNAMES,
        }
    ]
    schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_checksums() -> None:
    relative_paths = [
        "case.csv",
        "operational-evidence.csv",
        "eval.jsonl",
        "README.md",
        "schema.json",
        "source.json",
        "transform.py",
        "raw/order-set-v2.zip",
    ]
    lines = [f"{sha256(CASE_DIR / relative)}  {relative}" for relative in relative_paths]
    (CASE_DIR / "checksums.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--rebuild-public",
        action="store_true",
        help="also regenerate case.csv from the pinned raw public archive",
    )
    args = parser.parse_args()
    if args.rebuild_public:
        print(rebuild_public_slice())
    operational_rows = build_operational_evidence()
    write_contracts(operational_rows)
    write_checksums()
    print({"operational_rows": operational_rows, "path": "operational-evidence.csv"})
