"""Rebuild the deterministic MetroPT-3 course slice and its local contracts."""

from __future__ import annotations

from collections import deque
import csv
from datetime import datetime
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / "raw" / "metropt-3.zip"
OUTPUT = ROOT / "case.csv"
KNOWLEDGE = ROOT / "knowledge.jsonl"
SLICE_ROWS = 4090
ROWS_BEFORE_FAILURE = SLICE_ROWS // 2
FAILURE_BOUNDARY = datetime.fromisoformat("2020-04-18 00:00:00")
FAILURE_WINDOWS = (
    (datetime.fromisoformat("2020-04-18 00:00:00"), datetime.fromisoformat("2020-04-19 00:00:00")),
    (datetime.fromisoformat("2020-05-29 23:30:00"), datetime.fromisoformat("2020-05-30 06:00:00")),
    (datetime.fromisoformat("2020-06-05 00:00:00"), datetime.fromisoformat("2020-06-07 14:30:00")),
    (datetime.fromisoformat("2020-07-15 14:30:00"), datetime.fromisoformat("2020-07-15 19:00:00")),
)


def main() -> int:
    rows = read_contiguous_slice()
    write_case_csv(rows)
    validate_knowledge()
    write_eval(rows)
    write_schema(rows)
    write_source_contract(rows)
    write_readme()
    write_checksums()
    print(json.dumps({"rows": len(rows), "sha256": sha256(OUTPUT)}, ensure_ascii=False))
    return 0


def read_contiguous_slice() -> list[dict[str, str]]:
    before: deque[dict[str, str]] = deque(maxlen=ROWS_BEFORE_FAILURE)
    after: list[dict[str, str]] = []
    with ZipFile(ARCHIVE) as archive:
        member = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
        with archive.open(member) as binary:
            lines = (line.decode("utf-8") for line in binary)
            reader = csv.DictReader(lines)
            for raw in reader:
                timestamp = datetime.fromisoformat(raw["timestamp"])
                normalized = normalize_row(raw, timestamp)
                if timestamp < FAILURE_BOUNDARY:
                    before.append(normalized)
                    continue
                after.append(normalized)
                if len(after) == SLICE_ROWS - ROWS_BEFORE_FAILURE:
                    break

    rows = [*before, *after]
    if len(rows) != SLICE_ROWS:
        raise RuntimeError(f"expected {SLICE_ROWS} rows, got {len(rows)}")
    if any(datetime.fromisoformat(right["timestamp"]) <= datetime.fromisoformat(left["timestamp"]) for left, right in zip(rows, rows[1:])):
        raise RuntimeError("source slice is not strictly chronological")
    return rows


def normalize_row(raw: dict[str, str], timestamp: datetime) -> dict[str, str]:
    row = {("source_row_index" if key in {"", "Unnamed: 0"} else key): value for key, value in raw.items()}
    row["known_failure_window"] = str(any(start <= timestamp < end for start, end in FAILURE_WINDOWS))
    row["source_id"] = "DATA-09"
    row["maintenance_action_allowed"] = "False"
    row["data_nature"] = "public-derived-contiguous-slice"
    return row


def write_case_csv(rows: list[dict[str, str]]) -> None:
    with OUTPUT.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def validate_knowledge() -> None:
    documents = [json.loads(line) for line in KNOWLEDGE.read_text(encoding="utf-8").splitlines() if line.strip()]
    required = {"source-fact", "field-definition", "inspection-procedure", "approval-policy"}
    allowed_sources = {"DATA-09", "COURSE-POLICY-09"}
    present = {document["type"] for document in documents}
    if not required.issubset(present):
        raise RuntimeError(f"knowledge corpus missing: {sorted(required - present)}")
    if len({document["id"] for document in documents}) != len(documents):
        raise RuntimeError("knowledge corpus contains duplicate IDs")
    if any(document.get("source_id") not in allowed_sources for document in documents):
        raise RuntimeError("knowledge corpus contains an undeclared source_id")
    for document in documents:
        if document["source_id"] != "COURSE-POLICY-09":
            continue
        source = document.get("source", "")
        boundary = document.get("boundary", "")
        if not source.startswith("Course_AIProduct "):
            raise RuntimeError("course policy must identify Course_AIProduct as its source")
        if "课程" not in boundary or ("不是厂商" not in boundary and "不代表" not in boundary):
            raise RuntimeError("course policy must state that it is not vendor or operator authority")


def write_eval(rows: list[dict[str, str]]) -> None:
    path = ROOT / "eval.jsonl"
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        for index, row in enumerate(rows[:24]):
            payload = {
                "eval_id": f"09-E{index:04d}",
                "input": row,
                "expected_boundary": "传感窗口与检索命中只能创建待人工批准的检查工单，不能自动停机或维修。",
            }
            stream.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_schema(rows: list[dict[str, str]]) -> None:
    numeric = {
        "source_row_index",
        "TP2",
        "TP3",
        "H1",
        "DV_pressure",
        "Reservoirs",
        "Oil_temperature",
        "Motor_current",
        "COMP",
        "DV_eletric",
        "Towers",
        "MPG",
        "LPS",
        "Pressure_switch",
        "Oil_level",
        "Caudal_impulses",
    }
    boolean = {"known_failure_window", "maintenance_action_allowed"}
    columns = []
    for name, sample in rows[0].items():
        dtype = "float64" if name in numeric else "bool" if name in boolean else "string"
        columns.append({"name": name, "dtype": dtype, "nullable": False, "sample": sample})
    contract = {
        "schema_version": "2.0",
        "case_id": "09",
        "row_count": len(rows),
        "sampling_contract": {
            "method": "contiguous-fixed-slice",
            "failure_boundary": FAILURE_BOUNDARY.isoformat(sep=" "),
            "rows_before_boundary": ROWS_BEFORE_FAILURE,
            "rows_from_boundary": len(rows) - ROWS_BEFORE_FAILURE,
            "service_window": "fixed-5-minute",
        },
        "columns": columns,
        "data_nature": "public-derived-contiguous-slice",
        "source_ids": ["DATA-09"],
    }
    (ROOT / "schema.json").write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_source_contract(rows: list[dict[str, str]]) -> None:
    path = ROOT / "source.json"
    contract = json.loads(path.read_text(encoding="utf-8"))
    contract["schema_version"] = "2.0"
    sources = contract.setdefault("sources", [])
    for source in sources:
        if source.get("id") == "DATA-09":
            source["state"] = "artifact-and-metadata-verified"
    course_source = {
        "id": "COURSE-POLICY-09",
        "title": "压缩机检查程序与人工审批课程策略",
        "publisher": "Course_AIProduct",
        "version": "1.0.0",
        "license": "course-generated-fixture",
        "state": "generated-verified",
        "redistribution": "allowed-with-course",
        "usage_boundary": "课程内检查与审批策略，不是厂商维修手册或真实地铁运营制度。",
    }
    course_index = next((index for index, source in enumerate(sources) if source.get("id") == "COURSE-POLICY-09"), None)
    if course_index is None:
        sources.append(course_source)
    else:
        sources[course_index] = course_source
    contract["transform_status"] = "derived-verified"
    contract["derived_output"] = {
        "path": "case.csv",
        "rows": len(rows),
        "sha256": sha256(OUTPUT),
        "data_nature": "public-derived-contiguous-slice",
    }
    contract["sampling_contract"] = {
        "method": "contiguous-fixed-slice",
        "failure_boundary": FAILURE_BOUNDARY.isoformat(sep=" "),
        "rows_before_boundary": ROWS_BEFORE_FAILURE,
        "rows_from_boundary": len(rows) - ROWS_BEFORE_FAILURE,
        "workbench_window": "fixed-5-minute-25-source-records",
    }
    contract["knowledge_corpus"] = {
        "path": "knowledge.jsonl",
        "sha256": sha256(KNOWLEDGE),
        "source_ids": ["DATA-09", "COURSE-POLICY-09"],
        "versioned": True,
        "course_policies_are_not_vendor_manuals": True,
    }
    path.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    text = """# 地铁压缩机证据检索与检查工单

- `case.csv`：UCI MetroPT-3 原始 CSV 中围绕 2020-04-18 故障区间起点的连续固定切片，共 4,090 行。
- `knowledge.jsonl`：版本化浅层语料；每条记录用 `source_id` 区分公开数据事实与课程策略。
- `transform.py`：仅用 Python 标准库从固定 ZIP 重建切片、元数据、评测样本和哈希清单。

## 复现

在本目录运行 `python transform.py`。工作台从 23:57:30—00:02:30 的固定五分钟窗口读取 25 条来源记录，并直接绘制压力、油温和电机电流原值。

## 使用限制

传感数据来自可再分发的 UCI MetroPT-3；检查程序和审批策略是明确标注的课程规则，不是厂商维修手册，也不代表地铁运营方制度。检索命中只能创建待人工批准的现场检查工单，不能自动停机、维修、诊断故障或调用设备控制工具。
"""
    (ROOT / "README.md").write_text(text, encoding="utf-8")


def write_checksums() -> None:
    paths = [
        ROOT / "README.md",
        OUTPUT,
        ROOT / "eval.jsonl",
        KNOWLEDGE,
        ROOT / "schema.json",
        ROOT / "source.json",
        ROOT / "transform.py",
    ]
    lines = [f"{sha256(path)}  {path.name}" for path in paths]
    (ROOT / "checksums.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
