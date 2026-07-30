"""Build deterministic, non-clinical operational handoff fixtures for case 05."""
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEED = "hospital-flow-handoff-v2"
START = datetime(2026, 7, 3, 8, 0, tzinfo=timezone(timedelta(hours=8)))
FIELDS = [
    "event_id", "transport_id", "flow_token", "event_version", "event_time", "received_at",
    "source_system", "from_department", "to_department", "bed_request_id", "role", "actor_id",
    "event_type", "co_sign_status", "privacy_scope", "clinical_decision_allowed", "conflict_type", "late_event",
]
PATTERNS = ("late_event", "out_of_order", "duplicate", "missing", "mutually_exclusive", "late_reopen")


def stamp(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def make_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    departments = (("急诊观察区", "内科留观区"), ("急诊观察区", "外科留观区"), ("急诊抢救区", "日间诊疗区"))
    for index in range(1, 721):
        transport = f"TRN-{index:04d}"
        flow = f"FLOW-{index:04d}"
        bed = f"BED-{(index * 7) % 180 + 1:03d}"
        from_department, to_department = departments[index % len(departments)]
        base = START + timedelta(minutes=index * 7)
        pattern = PATTERNS[(index - 1) % len(PATTERNS)]
        events = [
            ("transport_requested", "ED_BOARD", "emergency_nurse", "ER-N-01", 0, 1, "pending", "none", "False"),
            ("transport_assigned", "TRANSPORT_DISPATCH", "transport_coordinator", "TR-C-01", 4, 6, "pending", "none", "False"),
            ("bed_request_confirmed", "BED_CONTROL", "bed_coordinator", "BED-C-01", 8, 10, "pending", "none", "False"),
            ("handoff_received", "WARD_BOARD", "bed_coordinator", "BED-C-01", 12, 14, "pending", "none", "False"),
            ("coordination_snapshot", "OPS_AUDIT", "coordination_lead", "COORD-01", 16, 18, "pending", "none", "False"),
            ("correction_appended", "OPS_AUDIT", "coordination_lead", "COORD-01", 20, 22, "pending", pattern, "False"),
        ]
        for version, (event_type, source, role, actor, event_offset, receive_offset, co_sign, conflict, late) in enumerate(events, start=1):
            event_time = base + timedelta(minutes=event_offset)
            received_at = base + timedelta(minutes=receive_offset)
            row = {
                "event_id": f"{transport}-{version:02d}", "transport_id": transport, "flow_token": flow,
                "event_version": str(version), "event_time": stamp(event_time), "received_at": stamp(received_at),
                "source_system": source, "from_department": from_department, "to_department": to_department,
                "bed_request_id": bed, "role": role, "actor_id": actor, "event_type": event_type,
                "co_sign_status": co_sign, "privacy_scope": "operational_only", "clinical_decision_allowed": "False",
                "conflict_type": conflict, "late_event": late,
            }
            if version == 6 and pattern == "late_event":
                row["received_at"] = stamp(event_time + timedelta(minutes=42)); row["late_event"] = "True"
            elif version == 6 and pattern == "out_of_order":
                row["event_time"] = stamp(base + timedelta(minutes=5)); row["received_at"] = stamp(base + timedelta(minutes=25))
            elif version == 6 and pattern == "duplicate":
                row["event_type"] = "handoff_received"; row["source_system"] = "WARD_BOARD"
            elif version == 6 and pattern == "missing":
                row["co_sign_status"] = "missing"
            elif version == 6 and pattern == "mutually_exclusive":
                row["co_sign_status"] = "confirmed_and_cancelled"
            elif version == 6 and pattern == "late_reopen":
                row["event_time"] = stamp(base + timedelta(minutes=9)); row["received_at"] = stamp(base + timedelta(minutes=48)); row["late_event"] = "True"
            rows.append(row)
    return rows


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(name: str, payload: object) -> None:
    (ROOT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    rows = make_rows()
    with (ROOT / "case.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS); writer.writeheader(); writer.writerows(rows)
    counts = {pattern: sum(row["conflict_type"] == pattern for row in rows) for pattern in PATTERNS}
    write_json("schema.json", {"schema_version": "2.0", "case_id": "B005", "row_count": len(rows), "columns": [{"name": field, "dtype": "string", "nullable": field == "co_sign_status", "sample": rows[0][field]} for field in FIELDS], "data_nature": "deterministic-synthetic-operational", "source_ids": ["DATA-05"]})
    write_json("source.json", {"schema_version": "2.0", "case_id": "B005", "seed": SEED, "captured_at": "2026-07-23T00:00:00+08:00", "sources": [{"id": "DATA-05", "title": "公开医疗运营字段结构参考", "url": "https://physionet.org/content/picdb/1.1.0/", "publisher": "PhysioNet", "version": "1.1.0", "license": "credentialing and DUA required", "state": "metadata-only", "redistribution": "no raw data", "course_use": "仅参考公开字段结构；不读取、校准或再分发原始记录"}], "transform_status": "derived-verified", "derived_output": {"path": "case.csv", "rows": len(rows), "sha256": sha256(ROOT / "case.csv"), "data_nature": "deterministic-synthetic-operational"}})
    write_json("expected.json", {"seed": SEED, "row_count": len(rows), "transport_count": 720, "event_versions": [1, 2, 3, 4, 5, 6], "fixed_coverage": counts, "safety": {"contains_pii": False, "contains_diagnosis": False, "contains_treatment": False, "clinical_decision_allowed_values": ["False"]}})
    (ROOT / "eval.jsonl").write_text("\n".join(json.dumps({"transport_id": f"TRN-{index:04d}", "expected_conflict": PATTERNS[(index - 1) % len(PATTERNS)]}, ensure_ascii=False) for index in range(1, 13)) + "\n", encoding="utf-8")
    (ROOT / "README.md").write_text("# 急诊转运交接协调\n\n- 数据性质：`deterministic-synthetic-operational`\n- 课程子集：`case.csv`，4,320 条匿名运营事件，720 张转运单\n- 生成命令：`python transform.py`\n\n## 数据边界\n\n- 记录仅用于展示转运单、床位请求、岗位会签、双时钟和冲突回放。\n- 不含姓名、证件、联系方式、病历、诊断、分诊或治疗字段。\n- 参考公开字段结构生成，不读取、校准或再分发原始医疗记录。\n- 固定覆盖迟到、乱序、重复、缺失、互斥与晚到重开；见 `expected.json`。\n\n文件哈希见 `checksums.sha256`。\n", encoding="utf-8")
    names = ["case.csv", "eval.jsonl", "expected.json", "README.md", "schema.json", "source.json", "transform.py"]
    (ROOT / "checksums.sha256").write_text("\n".join(f"{sha256(ROOT / name)}  {name}" for name in names) + "\n", encoding="utf-8")
    print(json.dumps({"rows": len(rows), "sha256": sha256(ROOT / "case.csv"), "coverage": counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
