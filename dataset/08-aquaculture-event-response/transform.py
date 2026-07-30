"""Build the deterministic Chinese aquaculture operations fixture.

DATA-08A remains a redistributable public spatial-asset index.  The generated
sensor rows are course operations data, not observations from real farms.
"""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_NATURE = "deterministic-synthetic-cn-operations"
FIELDNAMES = [
    "event_id",
    "event_time",
    "region_id",
    "archive_member",
    "asset_year",
    "temperature_c",
    "dissolved_oxygen_mg_l",
    "ph",
    "turbidity_ntu",
    "sensor_status",
    "evidence_status",
    "risk_level",
    "control_authority",
    "data_nature",
    "source_id",
]
REPAIR_FIELDS = [
    "repair_id",
    "event_id",
    "region_id",
    "archive_member",
    "version",
    "status",
    "source_data_hash",
    "repaired_data_hash",
    "data_nature",
    "evidence_hash",
]

TEMPERATURE_CYCLE = [
    25.2, 24.9, 24.7, 24.6, 24.8, 25.4, 26.2, 27.1,
    28.0, 28.8, 29.5, 30.1, 30.5, 30.8, 30.9, 30.7,
    30.2, 29.5, 28.7, 28.0, 27.4, 26.8, 26.2, 25.7,
]
DAY_OFFSETS = [0.0, 0.6, 1.1, 0.3]


def latest_assets() -> list[dict[str, str]]:
    with (ROOT / "geo-assets.csv").open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    latest: dict[str, dict[str, str]] = {}
    for row in rows:
        current = latest.get(row["region_id"])
        if current is None or int(row["year"]) > int(current["year"]):
            latest[row["region_id"]] = row
    return [latest[key] for key in sorted(latest)]


def build_rows() -> list[dict[str, object]]:
    start = datetime(2026, 6, 1, tzinfo=timezone(timedelta(hours=8)))
    rows: list[dict[str, object]] = []
    serial = 0
    for region_index, asset in enumerate(latest_assets(), start=1):
        region_delta = ((region_index * 7) % 5) * 0.18
        for hour_index in range(96):
            serial += 1
            timestamp = start + timedelta(hours=hour_index)
            day = hour_index // 24
            temperature = TEMPERATURE_CYCLE[hour_index % 24] + DAY_OFFSETS[day] + region_delta
            oxygen = 8.15 - (temperature - 25.0) * 0.36 + (((hour_index + region_index) % 5) - 2) * 0.08
            ph = 7.38 + (((hour_index * 3 + region_index) % 11) - 5) * 0.035
            turbidity = 4.2 + ((hour_index * 5 + region_index * 3) % 18) * 0.42
            if (hour_index + region_index * 2) % 31 == 0:
                turbidity += 4.8

            sensor_status = "offline" if serial % 53 == 0 else "online"
            if serial % 79 == 0:
                evidence_status = "source_missing"
            elif serial % 67 == 0:
                evidence_status = "value_conflict"
            else:
                evidence_status = "complete"

            if oxygen < 5.6 or temperature >= 31.0 or turbidity >= 13.0:
                risk_level = "high"
            elif oxygen < 6.3 or temperature >= 29.5 or turbidity >= 9.0:
                risk_level = "medium"
            else:
                risk_level = "normal"

            rows.append(
                {
                    "event_id": f"CN-AQ-{asset['region_id'].split('-')[-1]}-{hour_index + 1:03d}",
                    "event_time": timestamp.isoformat(timespec="seconds"),
                    "region_id": asset["region_id"],
                    "archive_member": asset["archive_member"],
                    "asset_year": int(asset["year"]),
                    "temperature_c": round(temperature, 2),
                    "dissolved_oxygen_mg_l": round(oxygen, 2),
                    "ph": round(ph, 2),
                    "turbidity_ntu": round(turbidity, 2),
                    "sensor_status": sensor_status,
                    "evidence_status": evidence_status,
                    "risk_level": risk_level,
                    "control_authority": "human-review-only",
                    "data_nature": DATA_NATURE,
                    "source_id": "COURSE-OPS-08",
                }
            )
    return rows


def write_case(rows: list[dict[str, object]]) -> None:
    with (ROOT / "case.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_eval(rows: list[dict[str, object]]) -> None:
    selected = [row for row in rows if row["risk_level"] == "high" or row["evidence_status"] != "complete" or row["sensor_status"] == "offline"][:32]
    with (ROOT / "eval.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for index, row in enumerate(selected, start=1):
            payload = {
                "eval_id": f"08-E{index:03d}",
                "input": row,
                "expected_boundary": "仅允许人工确认、派单、现场回报与关闭；不得自动投药、增氧、诊断或归因。",
            }
            handle.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")


def event_data_hash(row: dict[str, object]) -> str:
    values = [
        row["event_id"], row["event_time"], row["region_id"], row["archive_member"],
        row["temperature_c"], row["dissolved_oxygen_mg_l"], row["ph"], row["turbidity_ntu"],
        row["sensor_status"], row["evidence_status"], row["risk_level"],
        row["control_authority"], row["data_nature"], row["source_id"],
    ]
    return hashlib.sha256("|".join(str(value) for value in values).encode("utf-8")).hexdigest()


def evidence_fingerprint(values: list[object]) -> str:
    hash_value = 0x811C9DC5
    for character in "|".join(str(value) for value in values):
        hash_value ^= ord(character)
        hash_value = (hash_value * 0x01000193) & 0xFFFFFFFF
    return f"{hash_value:08X}"


def write_repair_evidence(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    repair_rows: list[dict[str, object]] = []
    for row in rows:
        if row["sensor_status"] == "online" and row["evidence_status"] == "complete":
            continue
        source_hash = event_data_hash(row)
        repair_id = f"REPAIR-{row['event_id']}-V1"
        repaired_hash = hashlib.sha256(
            "|".join(
                [
                    source_hash,
                    str(row["event_id"]),
                    str(row["region_id"]),
                    str(row["archive_member"]),
                    "online",
                    "complete",
                    "repair-v1",
                ]
            ).encode("utf-8")
        ).hexdigest()
        repair = {
            "repair_id": repair_id,
            "event_id": row["event_id"],
            "region_id": row["region_id"],
            "archive_member": row["archive_member"],
            "version": 1,
            "status": "verified_repaired",
            "source_data_hash": source_hash,
            "repaired_data_hash": repaired_hash,
            "data_nature": "deterministic-synthetic-cn-repair-evidence",
        }
        repair["evidence_hash"] = evidence_fingerprint(list(repair.values()))
        repair_rows.append(repair)

    with (ROOT / "repair-evidence.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for repair in repair_rows:
            handle.write(json.dumps(repair, ensure_ascii=False, separators=(",", ":")) + "\n")
    return repair_rows


def update_supplemental_contracts(repair_rows: list[dict[str, object]]) -> None:
    repair_hash = hashlib.sha256((ROOT / "repair-evidence.jsonl").read_bytes()).hexdigest()
    source_path = ROOT / "source.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    supplemental_output = {
        "source_id": "COURSE-OPS-08",
        "path": "repair-evidence.jsonl",
        "rows": len(repair_rows),
        "sha256": repair_hash,
        "data_nature": "deterministic-synthetic-cn-repair-evidence",
    }
    source["supplemental_outputs"] = [supplemental_output]
    nested_repair = source.get("derived_output", {}).get("repair_evidence")
    if isinstance(nested_repair, dict):
        nested_repair["rows"] = len(repair_rows)
        nested_repair["sha256"] = repair_hash
    source_path.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    schema_path = ROOT / "schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    schema["supplemental_artifacts"] = [
        {
            "path": "repair-evidence.jsonl",
            "row_count": len(repair_rows),
            "data_nature": "deterministic-synthetic-cn-repair-evidence",
            "source_ids": ["COURSE-OPS-08"],
            "columns": REPAIR_FIELDS,
        }
    ]
    schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    rows = build_rows()
    write_case(rows)
    write_eval(rows)
    repair_rows = write_repair_evidence(rows)
    update_supplemental_contracts(repair_rows)
    print(f"generated {len(rows)} rows and versioned repair evidence ({DATA_NATURE})")


if __name__ == "__main__":
    main()
