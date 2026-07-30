from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import shlex
import sys
import zipfile
from collections import defaultdict
from collections.abc import Iterable, Sequence
from typing import Any


CASE_SLUGS = {
    "B013": "auto-service-triage",
    "B014": "flotation-impurity-review",
    "B015": "wafer-quality-review",
    "B016": "wind-underperformance",
    "B017": "cutter-health-review",
    "B018": "boiler-temperature-review",
    "B019": "hydraulic-condition",
    "B020": "pv-loss-attribution",
}

SOURCE_DIRECTORIES = {
    "B013": "案例01_汽车售后服务辅助决策",
    "B014": "案例02_精矿杂质提前干预",
    "B016": "案例04_风电机组出力下偏定位台",
    "B017": "案例05_包装机切刀劣化复核/reference_data_analysis",
    "B018": "案例06_工业锅炉蒸汽温度持续偏离复核/reference_data_analysis",
    "B019": "案例07_液压系统状态监测/reference_data_analysis",
    "B020": "案例08_辐照转化效率异常归因",
}

SOURCE_CONTRACTS: dict[str, dict[str, Any]] = {
    "DATA-13": {
        "id": "DATA-13",
        "title": "Vehicle Service and Repair Dataset for Analysis",
        "url": "https://www.kaggle.com/datasets/neerugattivikram/vehicle-service-and-repair-dataset-for-analysis",
        "publisher": "Kaggle dataset by neerugattivikram",
        "version": "version 2 snapshot",
        "license": "CC0",
        "redistribution": "public-domain-dedication",
        "boundary": "customer repair summaries remain India-located public reference facts",
    },
    "COURSE-OPS-13": {
        "id": "COURSE-OPS-13",
        "title": "中国售后接车课程运营层",
        "publisher": "Course_AIProduct deterministic transform",
        "version": "2026.1",
        "license": "course-generated-fixture",
        "redistribution": "course-local",
        "data_nature": "deterministic-synthetic-cn-operations",
        "boundary": "not row-level linked to DATA-13 and not a real repair order",
    },
    "DATA-14": {
        "id": "DATA-14",
        "title": "Quality Prediction in a Mining Process",
        "url": "https://www.kaggle.com/datasets/edumagalhaes/quality-prediction-in-a-mining-process",
        "publisher": "Kaggle dataset by Eduardo Magalhaes Oliveira",
        "version": "fixed delivery snapshot",
        "license": "CC0",
        "redistribution": "public-domain-dedication",
    },
    "DATA-16": {
        "id": "DATA-16",
        "title": "Spatial Dynamic Wind Power Forecasting Dataset",
        "url": "https://doi.org/10.6084/m9.figshare.24798654",
        "publisher": "Figshare",
        "version": "SDWPF 245-day release; delivery-derived 80-day snapshot",
        "license": "CC BY 4.0",
        "redistribution": "allowed-with-attribution",
    },
    "DATA-17": {
        "id": "DATA-17",
        "title": "One Year Industrial Component Degradation",
        "url": "https://www.kaggle.com/datasets/inIT-OWL/one-year-industrial-component-degradation",
        "publisher": "Kaggle dataset by inIT-OWL",
        "version": "519-session deterministic delivery snapshot",
        "license": "CC BY-SA 3.0",
        "redistribution": "allowed-with-attribution-and-share-alike",
    },
    "DATA-18": {
        "id": "DATA-18",
        "title": "A long-tailed distribution time-series dataset in boiler equipment",
        "url": "https://springernature.figshare.com/articles/dataset/28868849",
        "publisher": "Springer Nature Figshare",
        "version": "posted 2025-05-06; fixed delivery-derived snapshot",
        "license": "CC0",
        "redistribution": "public-domain-dedication",
        "boundary": "dataset license does not apply to paper figures",
    },
    "DATA-19": {
        "id": "DATA-19",
        "title": "Condition Monitoring of Hydraulic Systems",
        "url": "https://archive.ics.uci.edu/dataset/447/condition+monitoring+of+hydraulic+systems",
        "publisher": "UCI Machine Learning Repository",
        "version": "dataset id 447; delivery-normalized snapshot",
        "doi": "10.24432/C5CW21",
        "license": "CC BY 4.0",
        "redistribution": "allowed-with-attribution",
    },
    "DATA-20": {
        "id": "DATA-20",
        "title": "Solar and wind power data from the Chinese State Grid Renewable Energy Generation Forecasting Competition",
        "url": "https://doi.org/10.6084/m9.figshare.17304221",
        "publisher": "Figshare",
        "version": "8-station delivery aggregation",
        "license": "CC0",
        "redistribution": "public-domain-dedication",
    },
}


def fixed_row_selection(rows: Sequence[dict[str, str]], *, start: int, count: int) -> list[dict[str, str]]:
    if start < 0 or count < 1:
        raise ValueError("start must be non-negative and count must be positive")
    selected = list(rows[start : start + count])
    if len(selected) != count:
        raise ValueError(f"requested {count} rows from offset {start}, found {len(selected)}")
    return selected


def assert_disjoint_fields(source_fields: Iterable[str], derived_fields: Iterable[str]) -> None:
    overlap = sorted(set(source_fields) & set(derived_fields))
    if overlap:
        raise ValueError(f"source and derived fields overlap: {', '.join(overlap)}")


def build_case13_layers(
    public_rows: Sequence[dict[str, str]], *, intake_count: int = 24
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    reference_rows = []
    for index, row in enumerate(public_rows, start=1):
        reference_rows.append(
            {
                "reference_id": f"VS-{index:04d}",
                "customer_id": row["客户ID"],
                "city": row["城市"],
                "state": row["州"],
                "service_history": row["服务历史"],
                "common_problem": row["常见问题"],
                "historical_solution": row["解决方案"],
                "vehicle_brand": row["车辆品牌"],
                "data_nature": "public-reference",
            }
        )

    symptoms = (
        ("制动时右前侧出现短促金属异响", "brake", "True"),
        ("缓慢爬坡后水温提示升高", "cooling", "True"),
        ("地库低速转弯时方向盘连续抖动", "steering", "True"),
        ("夜间启动后仪表反复提示蓄电池电压低", "electrical", "True"),
        ("仪表提示保养到期，想确认应做哪些检查", "maintenance", "False"),
        ("轮胎换位后高速行驶仍有轻微抖动", "tire", "False"),
        ("雨天低速制动时后部传来摩擦声", "brake", "True"),
        ("堵车约二十分钟后温度提示接近高位", "cooling", "True"),
        ("直线行驶正常，掉头时方向盘发涩", "steering", "True"),
        ("停放两天后启动较慢，仪表曾亮电池提示", "electrical", "True"),
        ("上次保养项目记不清，近期准备长途出行", "maintenance", "False"),
        ("补胎后胎压提示仍未消失", "tire", "False"),
        ("踩下制动踏板后异响偶尔伴随轻微振动", "brake", "True"),
        ("高速驶出后闻到异味，但未看到明显泄漏", "cooling", "True"),
        ("经过减速带后方向盘在低速时向一侧偏", "steering", "True"),
        ("打开空调和大灯后仪表亮度明显波动", "electrical", "True"),
        ("车辆使用频率低，已到时间保养周期", "maintenance", "False"),
        ("左后轮慢漏气，隔夜后胎压再次下降", "tire", "False"),
        ("倒车出库轻踩制动时出现尖锐声", "brake", "True"),
        ("短途行驶后风扇持续运转，温度提示偏高", "cooling", "True"),
        ("高速变道时方向盘反馈比平时更重", "steering", "True"),
        ("启动车辆时中控短暂重启，未确认警示内容", "electrical", "True"),
        ("里程接近保养节点，希望先核对历史项目", "maintenance", "False"),
        ("通过坑洼路面后右前轮附近持续有轻微震动", "tire", "False"),
    )
    regions = ("华东", "华南", "华北", "西南")
    intake_rows = []
    for index in range(intake_count):
        symptom, category, safety = symptoms[index % len(symptoms)]
        intake_rows.append(
            {
                "intake_id": f"CN-AS-{index + 1:03d}",
                "region": regions[index % len(regions)],
                "vehicle_class": ("乘用车", "轻型商用车")[index % 2],
                "symptom_text": symptom,
                "symptom_category": category,
                "safety_review_required": safety,
                "workflow_state": "待技师初检" if safety == "True" else "待服务顾问核对",
                "allowed_action": "handoff_to_technician" if safety == "True" else "lookup_reference",
                "row_level_link_to_reference": "False",
                "automatic_repair_allowed": "False",
                "data_nature": "deterministic-synthetic-cn-operations",
            }
        )
    return intake_rows, reference_rows


def secom_source_contract() -> dict[str, Any]:
    return {
        "id": "DATA-15",
        "title": "SECOM",
        "publisher": "UCI Machine Learning Repository",
        "dataset_id": 179,
        "version": "dataset id 179",
        "doi": "10.24432/C54305",
        "url": "https://archive.ics.uci.edu/dataset/179/secom",
        "download_url": "https://archive.ics.uci.edu/static/public/179/secom.zip",
        "license": "CC BY 4.0",
        "redistribution": "allowed-with-attribution",
    }


def _mean(values: list[float]) -> str:
    if not values:
        return ""
    return format(sum(values) / len(values), ".8g")


def _float(row: dict[str, str], field: str) -> float | None:
    value = str(row.get(field, "")).strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def aggregate_case16(
    rows: Iterable[dict[str, str]],
    locations: Sequence[dict[str, str]],
    *,
    selected_days: Sequence[int],
) -> list[dict[str, str]]:
    entity_ids = sorted({str(row["TurbID"]) for row in locations}, key=int)
    days = [str(day) for day in selected_days]
    location_by_id = {str(row["TurbID"]): row for row in locations}
    grouped: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"records": 0, "wind": [], "power": [], "flags": []}
    )
    for row in rows:
        key = (str(row.get("TurbID", "")), str(row.get("Day", "")))
        if key[0] in location_by_id and key[1] in days:
            stats = grouped[key]
            stats["records"] += 1
            if (value := _float(row, "Wspd")) is not None:
                stats["wind"].append(value)
            if (value := _float(row, "Patv")) is not None:
                stats["power"].append(value)
            if (value := _float(row, "is_underperforming")) is not None:
                stats["flags"].append(value)
    missing = [(entity, day) for entity in entity_ids for day in days if grouped[(entity, day)]["records"] == 0]
    if missing:
        rendered = ", ".join(f"{entity}/{day}" for entity, day in missing)
        raise ValueError(f"missing turbine/day groups: {rendered}")

    output = []
    for entity in entity_ids:
        for day in days:
            group = grouped[(entity, day)]
            wind = group["wind"]
            power = group["power"]
            flags = group["flags"]
            location = location_by_id[entity]
            output.append(
                {
                    "turbine_id": entity,
                    "day": day,
                    "source_records": str(group["records"]),
                    "valid_wind_records": str(len(wind)),
                    "valid_power_records": str(len(power)),
                    "mean_wind_speed": _mean(wind),
                    "mean_active_power": _mean(power),
                    "underperformance_share": _mean(flags),
                    "turbine_x": str(location["x"]),
                    "turbine_y": str(location["y"]),
                    "manual_inspection_only": "True",
                    "allowed_action": "adjust_inspection_priority",
                    "data_nature": "public-derived-entity-complete-daily-aggregate",
                }
            )
    return output


def aggregate_case20(
    rows: Iterable[dict[str, str]], *, expected_stations: Sequence[str] | None = None
) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {
            "records": 0,
            "capacity": "",
            "irradiance": [],
            "temperatures": [],
            "power": [],
            "efficiencies": [],
            "derating": [],
            "curtailment": [],
        }
    )
    stations: set[str] = set()
    dates: set[str] = set()
    for row in rows:
        station = str(row.get("station_id", "")).strip()
        date = str(row.get("Time", ""))[:10]
        if not station or len(date) != 10:
            continue
        stations.add(station)
        dates.add(date)
        stats = grouped[(station, date)]
        stats["records"] += 1
        stats["capacity"] = str(row.get("capacity_mw", ""))
        field_targets = (
            ("Total solar irradiance (W/m2)", "irradiance"),
            ("Air temperature", "temperatures"),
            ("Power (MW)", "power"),
            ("eff_ratio", "efficiencies"),
            ("temp_derating_pct", "derating"),
            ("is_curtailment_suspected", "curtailment"),
        )
        for field, target in field_targets:
            if (value := _float(row, field)) is not None:
                stats[target].append(value)
    station_order = sorted(stations, key=int)
    missing_stations = sorted(set(expected_stations or ()) - stations, key=int)
    if missing_stations:
        raise ValueError(f"missing station entities: {', '.join(missing_stations)}")

    output = []
    for station in station_order:
        for date in sorted(date for candidate, date in grouped if candidate == station):
            group = grouped[(station, date)]
            output.append(
                {
                    "station_id": station,
                    "date": date,
                    "capacity_mw": group["capacity"],
                    "source_records": str(group["records"]),
                    "mean_irradiance": _mean(group["irradiance"]),
                    "mean_air_temperature": _mean(group["temperatures"]),
                    "mean_power_mw": _mean(group["power"]),
                    "mean_efficiency_ratio": _mean(group["efficiencies"]),
                    "mean_temperature_derating_pct": _mean(group["derating"]),
                    "curtailment_suspected_share": _mean(group["curtailment"]),
                    "automatic_control_allowed": "False",
                    "allowed_action": "register_operations_review",
                    "data_nature": "public-derived-entity-complete-daily-aggregate",
                }
            )
    return output


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def csv_rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def write_csv(path: Path, rows: Sequence[dict[str, str]], fieldnames: Sequence[str] | None = None) -> list[str]:
    if fieldnames is None:
        if not rows:
            raise ValueError(f"cannot infer columns for empty output {path.name}")
        fieldnames = list(rows[0])
    columns = list(fieldnames)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return columns


def _source_path(source_root: Path, case_id: str, filename: str) -> Path:
    path = source_root / SOURCE_DIRECTORIES[case_id] / filename
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def _input_receipt(path: Path, source_root: Path | None, role: str) -> dict[str, Any]:
    try:
        relative = path.relative_to(source_root).as_posix() if source_root is not None else path.name
    except ValueError:
        relative = path.name
    return {
        "path": relative,
        "role": role,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def _transform_script(case_id: str) -> str:
    return f'''from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.build_demo_expansion import main

if __name__ == "__main__":
    raise SystemExit(main(["--case", "{case_id}", *sys.argv[1:]]))
'''


def _materialize_contract(
    *,
    output_root: Path,
    source_root: Path | None,
    case_id: str,
    title: str,
    primary_rows: list[dict[str, str]],
    source_ids: list[str],
    input_files: list[tuple[Path, str]],
    source_fields: list[str],
    derived_fields: list[str],
    parameters: dict[str, Any],
    supplemental: list[dict[str, Any]] | None = None,
    restriction: str,
) -> dict[str, Any]:
    assert_disjoint_fields(source_fields, derived_fields)
    directory = output_root / "dataset" / f"{case_id}-{CASE_SLUGS[case_id]}"
    directory.mkdir(parents=True, exist_ok=True)
    case_path = directory / "case.csv"
    columns = write_csv(case_path, primary_rows)

    supplemental_outputs = []
    supplemental_schema = []
    for artifact in supplemental or []:
        artifact_path = directory / artifact["path"]
        artifact_columns = write_csv(artifact_path, artifact["rows"], artifact.get("columns"))
        receipt = {
            "path": artifact["path"],
            "source_id": artifact["source_id"],
            "rows": len(artifact["rows"]),
            "sha256": sha256(artifact_path),
            "data_nature": artifact["data_nature"],
        }
        supplemental_outputs.append(receipt)
        supplemental_schema.append(
            {
                "path": artifact["path"],
                "row_count": len(artifact["rows"]),
                "columns": artifact_columns,
                "source_ids": [artifact["source_id"]],
                "data_nature": artifact["data_nature"],
            }
        )

    generation = {
        "generator": "tools/build_demo_expansion.py",
        "generator_version": "1.0.0",
        "selection": parameters,
        "field_lineage": {
            "source_facts": source_fields,
            "derived_fields": derived_fields,
        },
    }
    source_document = {
        "schema_version": "1.0",
        "case_id": case_id,
        "sources": [SOURCE_CONTRACTS[source_id] if source_id != "DATA-15" else secom_source_contract() for source_id in source_ids],
        "input_files": [_input_receipt(path, source_root, role) for path, role in input_files],
        "generation": generation,
        "supplemental_outputs": supplemental_outputs,
        "transform_status": "derived-verified",
        "materialized_status": "verified",
        "rebuild_status": "blocked_missing_inputs",
        "restriction": restriction,
    }
    schema_document = {
        "schema_version": "1.0",
        "case_id": case_id,
        "row_count": len(primary_rows),
        "columns": [
            {
                "name": column,
                "origin": "source-fact" if column in source_fields else "derived",
            }
            for column in columns
        ],
        "supplemental_artifacts": supplemental_schema,
    }
    (directory / "source.json").write_text(
        json.dumps(source_document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (directory / "schema.json").write_text(
        json.dumps(schema_document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (directory / "README.md").write_text(
        f"# 案例 {case_id} · {title}\n\n"
        f"主表 `case.csv` 共 {len(primary_rows)} 行，按 `source.json` 中的固定参数确定性生成。\n\n"
        f"## 数据与动作边界\n\n{restriction}\n\n"
        "源事实、展示映射、规则派生与课程运营层分别记录在 `source.json` 的字段血缘中；"
        "所有页面动作只创建人工复核入口。\n",
        encoding="utf-8",
    )
    eval_record = {
        "case_id": case_id,
        "check": "data-contract",
        "expected": "source hashes, deterministic selection, field lineage and manual action boundary remain verifiable",
    }
    (directory / "eval.jsonl").write_text(
        json.dumps(eval_record, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (directory / "transform.py").write_text(_transform_script(case_id), encoding="utf-8")

    checksum_files = sorted(
        path for path in directory.iterdir() if path.is_file() and path.name != "checksums.sha256"
    )
    (directory / "checksums.sha256").write_text(
        "".join(f"{sha256(path)}  {path.name}\n" for path in checksum_files), encoding="utf-8"
    )
    return {
        "case_id": case_id,
        "slug": CASE_SLUGS[case_id],
        "directory": f"dataset/{case_id}-{CASE_SLUGS[case_id]}",
        "source_ids": source_ids,
        "target_nature": primary_rows[0].get("data_nature", "public-derived"),
        "status": "derived-verified",
        "materialized_status": "verified",
        "rebuild_status": "blocked_missing_inputs",
        "restriction": restriction,
        "row_count": len(primary_rows),
        "column_count": len(columns),
        "sha256": sha256(case_path),
        "materialized_nature": primary_rows[0].get("data_nature", "public-derived"),
    }


def _case13(source_root: Path, intake_count: int) -> dict[str, Any]:
    source = _source_path(source_root, "13", "vehicle_service_records.csv")
    public = read_csv(source)
    intakes, references = build_case13_layers(public, intake_count=intake_count)
    return {
        "title": "售后接车初检与技师协同",
        "rows": intakes,
        "source_ids": ["DATA-13", "COURSE-OPS-13"],
        "inputs": [(source, "508-row public repair-summary reference snapshot")],
        "source_fields": [name for name in references[0] if name != "data_nature"] if references else [],
        "derived_fields": list(intakes[0]),
        "parameters": {"reference_selection": "all rows in source order", "intake_count": intake_count, "row_level_linkage": False},
        "supplemental": [{"path": "public-reference.csv", "rows": references, "source_id": "DATA-13", "data_nature": "public-reference"}],
        "restriction": "公开印度地域维修汇总与中国接车运营层不做行级关联；不得自动诊断、维修或更换零部件。",
    }


def _case14(source_root: Path, hours: int) -> dict[str, Any]:
    hourly_path = _source_path(source_root, "14", "flotation_hourly_zh.csv")
    event_path = _source_path(source_root, "14", "flotation_events_zh.csv")
    selected = fixed_row_selection(read_csv(hourly_path), start=0, count=hours)
    rows = []
    for row in selected:
        output = {
            "monitor_hour": row["监测小时"],
            "source_samples": row["源采样数"],
            "completeness_state": row["数据完整性状态"],
            "feed_iron_mean": row["给矿铁品位均值"],
            "feed_silica_mean": row["给矿二氧化硅品位均值"],
            "starch_flow_mean": row["淀粉流量均值"],
            "amine_flow_mean": row["胺类捕收剂流量均值"],
            "pulp_flow_mean": row["矿浆流量均值"],
            "pulp_ph_mean": row["矿浆pH均值"],
            "pulp_density_mean": row["矿浆密度均值"],
        }
        for number in range(1, 8):
            output[f"column_{number}_air_mean"] = row[f"{number}号浮选柱风量均值"]
            output[f"column_{number}_level_mean"] = row[f"{number}号浮选柱液位均值"]
        output.update(
            {
                "concentrate_iron_mean": row["精矿铁品位均值"],
                "concentrate_silica_mean": row["精矿二氧化硅品位均值"],
                "recent_silica_trend": row["最近6小时精矿二氧化硅趋势"],
                "quality_state": row["质量状态"],
                "consecutive_high_hours": row["连续高杂质小时数"],
                "causal_root_cause_allowed": "False",
                "automatic_setpoint_allowed": "False",
                "allowed_action": "request_process_review",
                "data_nature": "public-derived-contiguous-hour-slice",
            }
        )
        rows.append(output)
    start, end = rows[0]["monitor_hour"], rows[-1]["monitor_hour"]
    events = []
    for event in read_csv(event_path):
        if start <= event["开始小时"] <= end:
            events.append(
                {
                    "event_id": event["事件ID"],
                    "start_hour": event["开始小时"],
                    "end_hour": event["结束小时"],
                    "duration_hours": event["持续小时数"],
                    "peak_silica": event["峰值"],
                    "mean_silica": event["均值"],
                    "dominant_deviation": event["主要偏离变量"],
                    "recovery_hour": event["恢复小时"],
                    "rule_review_state": event["规则处置状态"],
                    "rule_threshold": event["教学阈值"],
                    "data_nature": "public-derived-rule-event-snapshot",
                }
            )
    return {
        "title": "精矿杂质持续风险复核",
        "rows": rows,
        "source_ids": ["DATA-14"],
        "inputs": [(hourly_path, "delivery-derived hourly decision table"), (event_path, "delivery-derived event snapshot")],
        "source_fields": [name for name in rows[0] if name not in {"causal_root_cause_allowed", "automatic_setpoint_allowed", "allowed_action", "data_nature"}],
        "derived_fields": ["causal_root_cause_allowed", "automatic_setpoint_allowed", "allowed_action", "data_nature"],
        "parameters": {"selection": "first contiguous source rows", "start_offset": 0, "hours": hours},
        "supplemental": [{"path": "events.csv", "rows": events, "columns": list(events[0]) if events else ["event_id"], "source_id": "DATA-14", "data_nature": "public-derived-rule-event-snapshot"}],
        "restriction": "3.0% 等规则阈值不是厂方标准；过程偏离只支持复采和工艺人工核查，不得自动调参。",
    }


def _read_secom(archive_path: Path) -> tuple[list[list[str]], list[tuple[str, str]]]:
    with zipfile.ZipFile(archive_path) as archive:
        data_name = next(name for name in archive.namelist() if Path(name).name == "secom.data")
        labels_name = next(name for name in archive.namelist() if Path(name).name == "secom_labels.data")
        data = [line.decode("utf-8").strip().split() for line in archive.open(data_name) if line.strip()]
        labels = []
        for raw_line in archive.open(labels_name):
            parts = shlex.split(raw_line.decode("utf-8").strip())
            labels.append((parts[0], parts[1]))
    if len(data) != len(labels):
        raise ValueError(f"SECOM data/label row mismatch: {len(data)}/{len(labels)}")
    return data, labels


def _case15(secom_archive: Path) -> dict[str, Any]:
    data, labels = _read_secom(secom_archive)
    feature_count = len(data[0])
    ranking = []
    for index in range(feature_count):
        pass_values = [float(row[index]) for row, label in zip(data, labels) if label[0] == "-1" and row[index] != "NaN"]
        fail_values = [float(row[index]) for row, label in zip(data, labels) if label[0] == "1" and row[index] != "NaN"]
        score = abs((sum(pass_values) / len(pass_values)) - (sum(fail_values) / len(fail_values))) if pass_values and fail_values else -1.0
        ranking.append((score, index, len(data) - len(pass_values) - len(fail_values)))
    selected = sorted(ranking, key=lambda item: (-item[0], item[1]))[: min(12, feature_count)]
    selected_indices = [index for _, index, _ in selected]
    rows = []
    for row_number, (features, (label, timestamp)) in enumerate(zip(data, labels), start=1):
        output = {
            "wafer_id": f"SECOM-{row_number:04d}",
            "test_timestamp": timestamp,
            "quality_label": "fail" if label == "1" else "pass",
        }
        for index in selected_indices:
            output[f"sensor_{index:03d}"] = "" if features[index] == "NaN" else features[index]
        output.update(
            {
                "review_priority": "quality-gate-review" if label == "1" else "routine-gate",
                "causal_root_cause_allowed": "False",
                "automatic_scrap_allowed": "False",
                "allowed_action": "submit_quality_review",
                "data_nature": "public-derived-fixed-sensor-slice",
            }
        )
        rows.append(output)
    ranking_rows = [
        {
            "sensor_id": f"sensor_{index:03d}",
            "absolute_class_mean_difference": format(score, ".8g"),
            "missing_rows": str(missing),
            "rank": str(rank),
            "data_nature": "rule-derived-association-ranking",
        }
        for rank, (score, index, missing) in enumerate(selected, start=1)
    ]
    return {
        "title": "晶圆质量门与工序排查",
        "rows": rows,
        "source_ids": ["DATA-15"],
        "inputs": [(secom_archive, "official UCI SECOM archive")],
        "source_fields": ["wafer_id", "test_timestamp", "quality_label", *[f"sensor_{index:03d}" for index in selected_indices]],
        "derived_fields": ["review_priority", "causal_root_cause_allowed", "automatic_scrap_allowed", "allowed_action", "data_nature"],
        "parameters": {"row_selection": "all official rows in source order", "sensor_selection": "top absolute pass/fail class-mean difference; ties by source index", "selected_sensor_indices": selected_indices},
        "supplemental": [{"path": "sensor-ranking.csv", "rows": ranking_rows, "source_id": "DATA-15", "data_nature": "rule-derived-association-ranking"}],
        "restriction": "传感器排序表示与质量标签的关联，不证明工序根因；不得自动报废或放行晶圆。",
    }


def _case16(source_root: Path, days: Sequence[int]) -> dict[str, Any]:
    scada_path = _source_path(source_root, "16", "sdwpf_scada_80d.csv")
    location_path = _source_path(source_root, "16", "sdwpf_baidukddcup2022_turb_location.csv")
    locations = read_csv(location_path)
    rows = aggregate_case16(csv_rows(scada_path), locations, selected_days=days)
    location_rows = [
        {"turbine_id": row["TurbID"], "turbine_x": row["x"], "turbine_y": row["y"], "data_nature": "public-location-fact"}
        for row in locations
    ]
    return {
        "title": "风机出力下偏与登检排序",
        "rows": rows,
        "source_ids": ["DATA-16"],
        "inputs": [(scada_path, "80-day public-derived SCADA snapshot"), (location_path, "turbine location table")],
        "source_fields": [name for name in rows[0] if name not in {"underperformance_share", "manual_inspection_only", "allowed_action", "data_nature"}],
        "derived_fields": ["underperformance_share", "manual_inspection_only", "allowed_action", "data_nature"],
        "parameters": {"selected_days": list(days), "entity_selection": "all turbines from location table", "aggregation": "turbine/day"},
        "supplemental": [{"path": "turbine-locations.csv", "rows": location_rows, "source_id": "DATA-16", "data_nature": "public-location-fact"}],
        "restriction": "underperformance_share 是点级下偏标记的日聚合，本地结果只有 0 和 1；它不是故障概率，也不能证明同群比较已经完成。",
    }


def _case17(source_root: Path, waveform_sessions: int, waveform_samples: int) -> dict[str, Any]:
    sessions_path = _source_path(source_root, "17", "blade_sessions_zh.csv")
    queue_path = _source_path(source_root, "17", "blade_review_queue_zh.csv")
    signals_path = _source_path(source_root, "17", "blade_signals_zh.csv")
    session_source = read_csv(sessions_path)
    rename = {
        "采样会话ID": "session_id", "来源文件": "source_file", "观测标签": "observation_label", "源批次序号": "source_batch_index",
        "源顺序": "source_order", "运行模式": "operating_mode", "源采样数": "source_samples", "切刀转矩均值": "cutter_torque_mean",
        "切刀转矩标准差": "cutter_torque_std", "切刀转矩RMS": "cutter_torque_rms", "切刀转矩绝对峰值": "cutter_torque_abs_peak",
        "切刀跟随误差均值": "cutter_follow_error_mean", "切刀跟随误差标准差": "cutter_follow_error_std", "切刀跟随误差RMS": "cutter_follow_error_rms",
        "切刀跟随误差绝对峰值": "cutter_follow_error_abs_peak", "薄膜跟随误差均值": "film_follow_error_mean", "薄膜跟随误差标准差": "film_follow_error_std",
        "薄膜跟随误差RMS": "film_follow_error_rms", "薄膜跟随误差绝对峰值": "film_follow_error_abs_peak", "健康偏离指数": "health_deviation_index",
        "教学阈值": "rule_threshold", "证据覆盖状态": "evidence_coverage", "主要偏离信号": "dominant_deviation_signal", "教学复核等级": "rule_review_level",
    }
    rows = []
    for source in session_source:
        output = {target: source.get(original, "") for original, target in rename.items()}
        output.update({"causal_root_cause_allowed": "False", "automatic_stop_allowed": "False", "automatic_replacement_allowed": "False", "allowed_action": "register_maintenance_candidate", "data_nature": "public-derived-session-summary"})
        rows.append(output)
    selected_sessions = [row["session_id"] for row in rows[:waveform_sessions]]
    counts = {session: 0 for session in selected_sessions}
    waveform_rows = []
    for source in csv_rows(signals_path):
        session = source.get("采样会话ID", "")
        if session in counts and counts[session] < waveform_samples:
            waveform_rows.append({
                "session_id": session,
                "sample_index": source.get("会话内采样序号", ""),
                "time_seconds": source.get("会话内时间秒", ""),
                "cutter_motor_torque": source.get("切刀电机转矩", ""),
                "cutter_follow_error": source.get("切刀位置跟随误差", ""),
                "film_follow_error": source.get("薄膜输送跟随误差", ""),
                "spindle_speed": source.get("主轴速度", ""),
                "data_nature": "public-waveform-fixed-slice",
            })
            counts[session] += 1
            if all(count == waveform_samples for count in counts.values()):
                break
    queue_rows = []
    for source in read_csv(queue_path):
        queue_rows.append({
            "review_id": source.get("复核序号", ""), "session_id": source.get("采样会话ID", ""), "observation_label": source.get("观测标签", ""),
            "operating_mode": source.get("运行模式", ""), "health_deviation_index": source.get("健康偏离指数", ""), "rule_threshold": source.get("教学阈值", ""),
            "dominant_deviation_signal": source.get("主要偏离信号", ""), "evidence_coverage": source.get("证据覆盖状态", ""), "rule_review_level": source.get("教学复核等级", ""),
            "suggested_manual_action": source.get("建议人工动作", ""), "data_nature": "rule-derived-review-queue-not-work-orders",
        })
    return {
        "title": "包装切刀状态复核与检修计划",
        "rows": rows,
        "source_ids": ["DATA-17"],
        "inputs": [(sessions_path, "delivery-derived session summary"), (queue_path, "rule-derived review queue"), (signals_path, "delivery-derived public waveform table")],
        "source_fields": [name for name in rows[0] if name not in {"causal_root_cause_allowed", "automatic_stop_allowed", "automatic_replacement_allowed", "allowed_action", "data_nature"}],
        "derived_fields": ["causal_root_cause_allowed", "automatic_stop_allowed", "automatic_replacement_allowed", "allowed_action", "data_nature"],
        "parameters": {"session_selection": "all sessions in source order", "waveform_sessions": waveform_sessions, "waveform_samples_per_session": waveform_samples},
        "supplemental": [
            {"path": "waveform.csv", "rows": waveform_rows, "source_id": "DATA-17", "data_nature": "public-waveform-fixed-slice"},
            {"path": "review-queue.csv", "rows": queue_rows, "source_id": "DATA-17", "data_nature": "rule-derived-review-queue-not-work-orders"},
        ],
        "restriction": "健康偏离与复核等级是规则派生，不是磨损率、寿命或根因；不得自动停机或更换切刀。",
    }


def _case18(source_root: Path) -> dict[str, Any]:
    minutes_path = _source_path(source_root, "18", "boiler_minutes_zh.csv")
    events_path = _source_path(source_root, "18", "boiler_events_zh.csv")
    samples_path = _source_path(source_root, "18", "boiler_samples_zh.csv")
    minute_rename = {
        "监测分钟": "monitor_minute", "有效采样数": "valid_samples", "锅炉出口蒸汽温度均值": "steam_temperature_mean",
        "锅炉出口蒸汽温度最小值": "steam_temperature_min", "锅炉出口蒸汽温度最大值": "steam_temperature_max", "锅炉出口蒸汽温度标准差": "steam_temperature_std",
        "温度状态": "temperature_state", "连续偏离分钟数": "consecutive_deviation_minutes", "数据完整性": "data_completeness", "近期趋势": "recent_trend",
    }
    rows = []
    for source in read_csv(minutes_path):
        output = {target: source.get(original, "") for original, target in minute_rename.items()}
        output.update({"source_interval_is_factory_limit": "False", "automatic_control_allowed": "False", "allowed_action": "submit_operations_review", "data_nature": "public-derived-minute-aggregate"})
        rows.append(output)
    event_rename = {
        "事件ID": "event_id", "开始时间": "start_time", "结束时间": "end_time", "持续秒数": "duration_seconds", "方向": "direction",
        "最低温度": "minimum_temperature", "最高温度": "maximum_temperature", "源采样数": "source_samples", "恢复时间": "recovery_time",
        "数据质量状态": "data_quality_state", "教学复核状态": "rule_review_state",
    }
    event_rows = [{**{target: source.get(original, "") for original, target in event_rename.items()}, "data_nature": "public-derived-rule-event-snapshot"} for source in read_csv(events_path)]
    imputation_rows = []
    for source in csv_rows(samples_path):
        if source.get("一级减温水流量原始缺失") == "是":
            imputation_rows.append({"sample_time": source.get("采样时间", ""), "original_missing": "True", "primary_desuperheater_water_flow_imputed": source.get("一级减温水流量填补值", ""), "imputation_source": source.get("填补来源", ""), "data_nature": "public-source-primary-desuperheater-water-flow-imputation"})
    return {
        "title": "锅炉主汽温度持续偏离复核",
        "rows": rows,
        "source_ids": ["DATA-18"],
        "inputs": [(minutes_path, "delivery-derived minute table"), (events_path, "delivery-derived event table"), (samples_path, "delivery-derived primary desuperheater water-flow sample table used only to explain source imputation")],
        "source_fields": [name for name in rows[0] if name not in {"source_interval_is_factory_limit", "automatic_control_allowed", "allowed_action", "data_nature"}],
        "derived_fields": ["source_interval_is_factory_limit", "automatic_control_allowed", "allowed_action", "data_nature"],
        "parameters": {"minute_selection": "all rows in source order", "imputation_selection": "only rows explicitly marked original missing"},
        "supplemental": [
            {"path": "events.csv", "rows": event_rows, "source_id": "DATA-18", "data_nature": "public-derived-rule-event-snapshot"},
            {"path": "imputation-points.csv", "rows": imputation_rows, "source_id": "DATA-18", "data_nature": "public-source-primary-desuperheater-water-flow-imputation"},
        ],
        "restriction": "530–545℃是来源数据区间，不是厂方控制限；imputation-points.csv 是一级减温水流量填补材料，不是主蒸汽温度填补点；不得自动调参。",
    }


def _case19(source_root: Path) -> dict[str, Any]:
    source_path = _source_path(source_root, "19", "液压系统状态监测_归一化.csv")
    rename = {
        "周期编号": "cycle_id", "主油路压力_均值": "main_pressure_mean", "回油路压力_均值": "return_pressure_mean", "系统工作压力_均值": "system_pressure_mean",
        "电机功率_均值": "motor_power_mean", "主回路流量_均值": "main_flow_mean", "油箱油液温度_均值": "tank_temperature_mean", "系统振动_均值": "system_vibration_mean",
        "板式冷却器_条件值": "cooler_condition", "板式冷却器_状态": "cooler_state", "板式冷却器_严重度": "cooler_severity",
        "比例伺服阀_条件值": "valve_condition", "比例伺服阀_状态": "valve_state", "比例伺服阀_严重度": "valve_severity",
        "轴向柱塞泵_条件值": "pump_condition", "轴向柱塞泵_状态": "pump_state", "轴向柱塞泵_严重度": "pump_severity",
        "皮囊式蓄能器_条件值": "accumulator_condition", "皮囊式蓄能器_状态": "accumulator_state", "皮囊式蓄能器_严重度": "accumulator_severity",
        "稳定标志": "stability_flag", "稳定标志_中文": "stability_label", "综合严重度": "overall_severity", "综合严重度_中文": "overall_severity_label", "故障组件数": "affected_component_count",
    }
    rows = []
    for source in read_csv(source_path):
        output = {target: source.get(original, "") for original, target in rename.items()}
        output.update({"automatic_maintenance_allowed": "False", "allowed_action": "route_maintenance_review", "data_nature": "public-derived-cycle-feature-table"})
        rows.append(output)
    return {
        "title": "液压系统多部件状态分流",
        "rows": rows,
        "source_ids": ["DATA-19"],
        "inputs": [(source_path, "delivery-normalized UCI cycle feature table")],
        "source_fields": [name for name in rows[0] if name not in {"automatic_maintenance_allowed", "allowed_action", "data_nature"}],
        "derived_fields": ["automatic_maintenance_allowed", "allowed_action", "data_nature"],
        "parameters": {"cycle_selection": "all 2205 cycles in source order", "component_selection": "all four source-labelled components"},
        "supplemental": [],
        "restriction": "组件状态来自 UCI 标签和公开派生特征，只分流人工检修复核，不自动执行维护。",
    }


def _case20(source_root: Path) -> dict[str, Any]:
    source_path = _source_path(source_root, "20", "stategrid_pv_8stations.csv")
    rows = aggregate_case20(csv_rows(source_path), expected_stations=tuple(str(index) for index in range(1, 9)))
    station_rows = []
    seen = set()
    for source in csv_rows(source_path):
        station = source.get("station_id", "")
        if station and station not in seen:
            station_rows.append({"station_id": station, "capacity_mw": source.get("capacity_mw", ""), "data_nature": "public-station-fact"})
            seen.add(station)
    return {
        "title": "光伏电站转化效率损失排查",
        "rows": rows,
        "source_ids": ["DATA-20"],
        "inputs": [(source_path, "8-station public SCADA delivery snapshot")],
        "source_fields": [name for name in rows[0] if name not in {"mean_efficiency_ratio", "mean_temperature_derating_pct", "curtailment_suspected_share", "automatic_control_allowed", "allowed_action", "data_nature"}],
        "derived_fields": ["mean_efficiency_ratio", "mean_temperature_derating_pct", "curtailment_suspected_share", "automatic_control_allowed", "allowed_action", "data_nature"],
        "parameters": {"entity_selection": "all eight stations", "time_selection": "all observed dates within each station; no cross-station date imputation", "aggregation": "station/day"},
        "supplemental": [{"path": "stations.csv", "rows": station_rows, "source_id": "DATA-20", "data_nature": "public-station-fact"}],
        "restriction": "mean_efficiency_ratio 是上游 eff_ratio 的日均值，称为归一化出力比，不是物理转换效率；温度降额和疑似限电占比也只是站端核查线索。",
    }


def _update_manifest(output_root: Path, items: Sequence[dict[str, Any]]) -> None:
    path = output_root / "dataset" / "manifest.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    selected = {item["case_id"] for item in items}
    datasets = [item for item in document.get("datasets", []) if item.get("case_id") not in selected]
    datasets.extend(items)
    document["datasets"] = sorted(datasets, key=lambda item: int(item["case_id"]))
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _update_ledger(output_root: Path, source_ids: set[str]) -> None:
    path = output_root / "sources" / "source-ledger.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    sources = [source for source in document.get("sources", []) if source.get("id") not in source_ids]
    for source_id in sorted(source_ids):
        sources.append(secom_source_contract() if source_id == "DATA-15" else SOURCE_CONTRACTS[source_id])
    document["sources"] = sources
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_all(
    *,
    source_root: Path | None,
    output_root: Path,
    secom_archive: Path | None,
    case14_hours: int = 720,
    case16_days: Sequence[int] = tuple(range(1, 8)),
    case17_waveform_sessions: int = 8,
    case17_waveform_samples: int = 256,
    case13_intakes: int = 24,
    selected_cases: set[str] | None = None,
) -> list[dict[str, Any]]:
    selected_cases = set(CASE_SLUGS) if selected_cases is None else set(selected_cases)
    needs_source_root = any(case_id != "15" for case_id in selected_cases)
    if needs_source_root and source_root is None:
        raise ValueError("source_root is required when building cases other than 15")
    if "15" in selected_cases and secom_archive is None:
        raise ValueError("secom_archive is required when building case 15")

    source_root = source_root.resolve() if source_root is not None else None
    output_root = output_root.resolve()
    secom_archive = secom_archive.resolve() if secom_archive is not None else None
    builders = {
        "B013": lambda: _case13(source_root, case13_intakes),
        "B014": lambda: _case14(source_root, case14_hours),
        "B015": lambda: _case15(secom_archive),
        "B016": lambda: _case16(source_root, case16_days),
        "B017": lambda: _case17(source_root, case17_waveform_sessions, case17_waveform_samples),
        "B018": lambda: _case18(source_root),
        "B019": lambda: _case19(source_root),
        "B020": lambda: _case20(source_root),
    }
    items = []
    for case_id in sorted(selected_cases, key=int):
        contract = builders[case_id]()
        items.append(
            _materialize_contract(
                output_root=output_root,
                source_root=source_root,
                case_id=case_id,
                title=contract["title"],
                primary_rows=contract["rows"],
                source_ids=contract["source_ids"],
                input_files=contract["inputs"],
                source_fields=contract["source_fields"],
                derived_fields=contract["derived_fields"],
                parameters=contract["parameters"],
                supplemental=contract["supplemental"],
                restriction=contract["restriction"],
            )
        )
    _update_manifest(output_root, items)
    _update_ledger(output_root, {source_id for item in items for source_id in item["source_ids"]})
    return items


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build deterministic local datasets for cases 13-20")
    parser.add_argument("--source-root", type=Path)
    parser.add_argument("--secom-archive", type=Path)
    parser.add_argument("--output-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--case", action="append", choices=sorted(CASE_SLUGS))
    args = parser.parse_args(argv)
    selected_cases = set(args.case) if args.case else set(CASE_SLUGS)
    missing_arguments = []
    if any(case_id != "15" for case_id in selected_cases) and args.source_root is None:
        missing_arguments.append("--source-root is required when building cases other than 15")
    if "15" in selected_cases and args.secom_archive is None:
        missing_arguments.append("--secom-archive is required when building case 15")
    if missing_arguments:
        parser.error("; ".join(missing_arguments))
    items = build_all(
        source_root=args.source_root,
        output_root=args.output_root,
        secom_archive=args.secom_archive,
        selected_cases=selected_cases,
    )
    print(f"DEMO DATA EXPANSION BUILT cases={len(items)} rows={sum(item['row_count'] for item in items)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
