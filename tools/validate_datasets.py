from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_ROOT = ROOT / "dataset"
MANIFEST_PATH = DATASET_ROOT / "manifest.json"
LEDGER_PATH = ROOT / "sources" / "source-ledger.json"
REQUIRED_PRODUCT = ["README.md", "source.json", "schema.json", "eval.jsonl", "transform.py", "checksums.sha256"]
REQUIRED_LAB = ["README.md", "source.json", "schema.json", "checksums.sha256"]
BLOCKED_REBUILD_STATUS = "blocked_missing_inputs"
REBUILD_STATUSES = {BLOCKED_REBUILD_STATUS, "verified"}
SHA256_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")
PROMPT_REQUIRED_KEYS = {
    "schemaVersion",
    "caseId",
    "systemPrompt",
    "sharedContext",
    "baselinePrompt",
    "improvedPrompt",
    "model",
    "evaluators",
}
CASE_05_FORBIDDEN_COLUMNS = {
    "patient_id",
    "patient_name",
    "name",
    "id_card",
    "identity_number",
    "phone",
    "mobile",
    "address",
    "medical_record",
    "diagnosis",
    "diagnosis_code",
    "symptom",
    "triage",
    "treatment",
    "medication",
    "full_name",
    "first_name",
    "last_name",
    "birth_date",
    "date_of_birth",
    "dob",
    "patient_identifier",
    "medical_record_number",
    "mrn",
    "email",
    "diagnostic_text",
    "diagnosis_text",
    "chief_complaint",
    "treatment_plan",
    "prescription",
}


def item_case_ids(item: dict) -> list[str]:
    case_ids = item.get("case_ids")
    if case_ids is not None:
        return [str(case_id) for case_id in case_ids]
    return [str(item["case_id"])]


def forbidden_medical_columns(fieldnames: list[str]) -> list[str]:
    forbidden: list[str] = []
    identity_tokens = {"id", "identifier", "identity", "name", "birth", "dob", "record", "mrn", "phone", "mobile", "address", "email"}
    clinical_prefixes = ("diagnos", "symptom", "disease", "triage", "treatment", "medication", "prescription")
    for raw_name in fieldnames:
        normalized = re.sub(r"[^a-z0-9]+", "_", raw_name.strip().lower()).strip("_")
        tokens = set(normalized.split("_"))
        patient_identifier = "patient" in tokens and bool(tokens & identity_tokens)
        clinical_content = normalized.startswith(clinical_prefixes) or any(
            f"_{prefix}" in normalized for prefix in clinical_prefixes
        )
        if normalized in CASE_05_FORBIDDEN_COLUMNS or patient_identifier or clinical_content:
            forbidden.append(normalized)
    return sorted(set(forbidden))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_checksums(
    case_id: str,
    directory: Path,
    required_names: set[str],
) -> list[str]:
    errors: list[str] = []
    checksum_path = directory / "checksums.sha256"
    covered: set[str] = set()
    for line_number, line in enumerate(checksum_path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        parts = line.split(None, 1)
        if len(parts) != 2 or not SHA256_PATTERN.fullmatch(parts[0]):
            errors.append(f"{case_id}: checksum 第 {line_number} 行格式无效")
            continue
        expected, relative_text = parts
        relative = relative_text.strip()
        if relative in covered:
            errors.append(f"{case_id}: checksum 重复文件 {relative}")
            continue
        covered.add(relative)
        candidate = Path(relative)
        path = (directory / candidate).resolve()
        if candidate.is_absolute() or directory not in path.parents:
            errors.append(f"{case_id}: checksum 路径越界 {relative}")
        elif not path.is_file() or sha256(path) != expected.lower():
            errors.append(f"{case_id}: checksum 失败 {relative}")
    missing = sorted(required_names - covered)
    if missing:
        errors.append(f"{case_id}: checksum 未覆盖 {', '.join(missing)}")
    return errors


def validate_grouped_contract(
    item: dict,
    case_ids: list[str],
    directory: Path,
    schema: dict,
) -> list[str]:
    errors: list[str] = []
    case_id = "/".join(case_ids)
    primary_files = item.get("primary_files")
    if not isinstance(primary_files, list) or not primary_files:
        return [f"{case_id}: grouped contract 缺少 primary_files"]
    if item.get("record_count") != len(case_ids):
        errors.append(f"{case_id}: record_count 与 case_ids 数量不一致")
    if len(primary_files) not in {1, len(case_ids)}:
        errors.append(f"{case_id}: primary_files 必须为单一共享合同或逐案例文件")

    resolved: list[Path] = []
    for relative_text in primary_files:
        relative = Path(str(relative_text))
        path = (directory / relative).resolve()
        if relative.is_absolute() or directory not in path.parents:
            errors.append(f"{case_id}: primary_files 路径越界 {relative_text}")
        elif not path.is_file():
            errors.append(f"{case_id}: primary_files 缺失 {relative_text}")
        else:
            resolved.append(path)

    if case_ids and all(re.fullmatch(r"P\d{2}", value) for value in case_ids):
        if len(resolved) == len(case_ids):
            for expected_id, path in zip(case_ids, resolved, strict=True):
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                except json.JSONDecodeError as exc:
                    errors.append(f"{expected_id}: Prompt JSON 无效 {path.name}: {exc}")
                    continue
                missing = sorted(PROMPT_REQUIRED_KEYS - set(payload))
                if missing:
                    errors.append(f"{expected_id}: Prompt 清单缺少 {', '.join(missing)}")
                if not str(payload.get("caseId", "")).startswith(f"{expected_id}-"):
                    errors.append(f"{expected_id}: Prompt caseId 与文件顺序不一致")
                if not isinstance(payload.get("evaluators"), list) or not payload.get("evaluators"):
                    errors.append(f"{expected_id}: Prompt evaluators 不能为空")

    if case_ids and all(re.fullmatch(r"L\d{2}", value) for value in case_ids):
        schema_ids = [entry.get("id") for entry in schema.get("cases", [])]
        if schema_ids != case_ids:
            errors.append(f"{case_id}: Loop schema case 顺序不一致 {schema_ids}")
        for entry in schema.get("cases", []):
            for declared in entry.get("inputs", []):
                relative = Path(str(declared))
                path = (ROOT / relative).resolve()
                if relative.is_absolute() or ROOT.resolve() not in path.parents:
                    errors.append(f"{entry.get('id')}: Loop 输入路径越界 {declared}")
                elif not path.is_file():
                    errors.append(f"{entry.get('id')}: Loop 输入缺失 {declared}")
            if entry.get("terminal") not in {"completed", "waiting_human", "blocked"}:
                errors.append(f"{entry.get('id')}: Loop terminal 无效")
    return errors


def validate_reproducibility_status(case_id: str, item: dict, source: dict) -> list[str]:
    """Keep new reproducibility metadata aligned while accepting legacy source schemas."""

    errors: list[str] = []
    source_materialized = source.get("materialized_status")
    manifest_materialized = item.get("materialized_status")
    source_rebuild = source.get("rebuild_status")
    manifest_rebuild = item.get("rebuild_status")
    if all(value is None for value in (
        source_materialized,
        manifest_materialized,
        source_rebuild,
        manifest_rebuild,
    )):
        return errors

    if source_materialized != "verified":
        errors.append(f"{case_id}: materialized_status 必须为 verified")
    if manifest_materialized != source_materialized:
        errors.append(f"{case_id}: manifest/source materialized_status 不一致")
    if source_rebuild not in REBUILD_STATUSES:
        errors.append(f"{case_id}: rebuild_status 无效 {source_rebuild}")
    if manifest_rebuild != source_rebuild:
        errors.append(f"{case_id}: manifest/source rebuild_status 不一致")
    return errors


def validate_input_files(
    case_id: str,
    directory: Path,
    source: dict,
    *,
    require_rebuildable: bool = False,
) -> list[str]:
    """Audit declared upstream inputs without making snapshot-only validation dishonest.

    Relative input paths have one unambiguous base: the case directory. Legacy source
    documents without ``input_files`` remain valid. A declared blocked rebuild may omit
    local inputs during ordinary snapshot validation, while strict validation requires
    every input to be present. Any input that is present must match its receipt in both
    modes.
    """

    errors: list[str] = []
    raw_inputs = source.get("input_files")
    if raw_inputs is None:
        return errors
    if not isinstance(raw_inputs, list):
        return [f"{case_id}: input_files 必须为数组"]

    missing: list[str] = []
    case_root = directory.resolve()
    for index, receipt in enumerate(raw_inputs, start=1):
        if not isinstance(receipt, dict):
            errors.append(f"{case_id}: input_files[{index}] 必须为对象")
            continue
        declared = str(receipt.get("path", "")).strip()
        if not declared:
            errors.append(f"{case_id}: input_files[{index}] 缺少 path")
            continue
        relative = Path(declared)
        if relative.is_absolute():
            errors.append(f"{case_id}: 重建输入必须使用案例目录相对路径 {declared}")
            continue
        path = (directory / relative).resolve()
        if case_root not in path.parents:
            errors.append(f"{case_id}: 重建输入路径越界 {declared}")
            continue

        expected_bytes = receipt.get("bytes")
        if expected_bytes is not None and (
            isinstance(expected_bytes, bool)
            or not isinstance(expected_bytes, int)
            or expected_bytes < 0
        ):
            errors.append(f"{case_id}: 重建输入 bytes 无效 {declared}")
            expected_bytes = None
        expected_sha = receipt.get("sha256")
        if expected_sha is not None and not SHA256_PATTERN.fullmatch(str(expected_sha)):
            errors.append(f"{case_id}: 重建输入 sha256 无效 {declared}")
            expected_sha = None

        if not path.is_file():
            missing.append(declared)
            continue
        if expected_bytes is not None and path.stat().st_size != expected_bytes:
            errors.append(
                f"{case_id}: 重建输入字节数不一致 {declared} "
                f"({path.stat().st_size}/{expected_bytes})"
            )
        if expected_sha is not None and sha256(path).lower() != str(expected_sha).lower():
            errors.append(f"{case_id}: 重建输入哈希不一致 {declared}")

    rebuild_status = source.get("rebuild_status")
    if missing and (require_rebuildable or rebuild_status != BLOCKED_REBUILD_STATUS):
        errors.extend(f"{case_id}: 重建输入缺失 {relative}" for relative in missing)
    elif require_rebuildable and rebuild_status == BLOCKED_REBUILD_STATUS:
        errors.append(f"{case_id}: rebuild_status 仍为 {BLOCKED_REBUILD_STATUS}")
    return errors


def validate_source_lineage(case_id: str, source: dict) -> list[str]:
    lineage = source.get("generation", {}).get("field_lineage", {})
    source_facts = set(lineage.get("source_facts", []))
    derived_fields = set(lineage.get("derived_fields", []))
    overlap = sorted(source_facts & derived_fields)
    if overlap:
        return [f"{case_id}: 字段同时声明为源事实和派生字段 {', '.join(overlap)}"]
    return []


def validate_csv_contract(item: dict, schema: dict, fieldnames: list[str], rows: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    case_id = item["case_id"]
    schema_columns = [column.get("name") for column in schema.get("columns", [])]
    expected_count = item.get("column_count")
    if expected_count is None or len(schema_columns) != expected_count or len(fieldnames) != expected_count:
        errors.append(
            f"{case_id}: manifest/schema/CSV 列数不一致 "
            f"({expected_count}/{len(schema_columns)}/{len(fieldnames)})"
        )
    if schema_columns != fieldnames:
        errors.append(f"{case_id}: schema/CSV 列名或顺序不一致")

    if case_id == "05":
        forbidden = forbidden_medical_columns(fieldnames)
        if forbidden:
            errors.append(f"05: 医学运营数据包含禁用字段 {', '.join(forbidden)}")
        if any(row.get("privacy_scope") != "operational_only" for row in rows):
            errors.append("05: privacy_scope 必须全部为 operational_only")
        if any(str(row.get("clinical_decision_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("05: clinical_decision_allowed 必须全部为 False")
    if case_id == "11":
        gates = {str(row.get("gate", "")).strip() for row in rows}
        if gates != {"risk", "fairness", "safety"}:
            errors.append("11: 必须同时包含 risk/fairness/safety 三类门禁")
        required_values = ("metric_value", "threshold", "sample_size")
        if any(not str(row.get(name, "")).strip() for row in rows for name in required_values):
            errors.append("11: 门禁指标、阈值和样本量不能为空")
    if case_id == "13":
        if any(str(row.get("row_level_link_to_reference", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("13: 公开参考与中国接车记录不得行级关联")
        if any(str(row.get("automatic_repair_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("13: 不得自动维修")
        allowed = {"lookup_reference", "handoff_to_technician", "request_more_info"}
        if any(str(row.get("allowed_action", "")) not in allowed for row in rows):
            errors.append("13: allowed_action 超出人工接车动作白名单")
    if case_id == "14":
        if any(str(row.get("automatic_setpoint_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("14: 不得自动下发浮选设定值")
        if any(str(row.get("causal_root_cause_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("14: 过程偏离不得写成根因")
        if any(str(row.get("allowed_action", "")) != "request_process_review" for row in rows):
            errors.append("14: allowed_action 仅允许发起工艺复核")
    if case_id == "15":
        if any(str(row.get("causal_root_cause_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("15: 传感器关联不得写成根因")
        if any(str(row.get("automatic_scrap_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("15: 不得自动报废晶圆")
        if any(str(row.get("allowed_action", "")) != "submit_quality_review" for row in rows):
            errors.append("15: allowed_action 仅允许送入质量复核")
    if case_id == "16":
        if any(str(row.get("manual_inspection_only", "")).strip().lower() not in {"true", "1"} for row in rows):
            errors.append("16: 不得自动派发登检")
        if any(str(row.get("allowed_action", "")) != "adjust_inspection_priority" for row in rows):
            errors.append("16: allowed_action 仅允许调整人工登检优先级")
    if case_id == "17":
        if any(str(row.get("automatic_stop_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("17: 不得自动停机")
        if any(str(row.get("automatic_replacement_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("17: 不得自动更换切刀")
        if any(str(row.get("allowed_action", "")) != "register_maintenance_candidate" for row in rows):
            errors.append("17: allowed_action 仅允许登记检修候选")
    if case_id == "18":
        if any(str(row.get("automatic_control_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("18: 不得自动控制锅炉")
        if any(str(row.get("source_interval_is_factory_limit", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("18: 来源区间不得写成厂方控制限")
        if any(str(row.get("allowed_action", "")) != "submit_operations_review" for row in rows):
            errors.append("18: allowed_action 仅允许运行复核")
    if case_id == "19":
        if any(str(row.get("automatic_maintenance_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("19: 不得自动执行液压检修")
        if any(str(row.get("allowed_action", "")) != "route_maintenance_review" for row in rows):
            errors.append("19: allowed_action 仅允许分流人工检修复核")
    if case_id == "20":
        if any(str(row.get("automatic_control_allowed", "")).strip().lower() not in {"false", "0"} for row in rows):
            errors.append("20: 不得自动控制电站")
        if any(str(row.get("allowed_action", "")) != "register_operations_review" for row in rows):
            errors.append("20: allowed_action 仅允许登记运行复核")
    return errors


def validate_supplemental_outputs(case_id: str, directory: Path, source: dict, schema: dict) -> list[str]:
    """Validate declared non-primary dataset artifacts without silently omitting them."""

    errors: list[str] = []
    declared_source_ids = {item.get("id") for item in source.get("sources", [])}
    schema_by_path = {
        item.get("path"): item
        for item in schema.get("supplemental_artifacts", [])
        if item.get("path")
    }
    outputs = source.get("supplemental_outputs", [])
    for output in outputs:
        relative = str(output.get("path", "")).strip()
        source_id = output.get("source_id")
        if source_id not in declared_source_ids:
            errors.append(f"{case_id}: 补充数据来源未声明 {source_id}")

        path = (directory / relative).resolve()
        if not relative or directory.resolve() not in path.parents:
            errors.append(f"{case_id}: 补充数据路径越界 {relative}")
            continue
        if not path.is_file():
            errors.append(f"{case_id}: 补充数据文件不存在 {relative}")
            continue
        if sha256(path) != output.get("sha256"):
            errors.append(f"{case_id}: 补充数据哈希不一致 {relative}")

        artifact_schema = schema_by_path.get(relative)
        if artifact_schema is None:
            errors.append(f"{case_id}: schema 未声明补充数据 {relative}")
            continue
        if artifact_schema.get("row_count") != output.get("rows"):
            errors.append(f"{case_id}: 补充数据 source/schema 行数不一致 {relative}")
        if artifact_schema.get("data_nature") != output.get("data_nature"):
            errors.append(f"{case_id}: 补充数据性质不一致 {relative}")
        if source_id not in set(artifact_schema.get("source_ids", [])):
            errors.append(f"{case_id}: 补充数据 schema 缺少来源 {source_id}")

        actual_rows: list[dict[str, str]] = []
        fieldnames: list[str] = []
        if path.suffix.lower() == ".csv":
            with path.open("r", encoding="utf-8", newline="") as stream:
                reader = csv.DictReader(stream)
                actual_rows = list(reader)
                fieldnames = reader.fieldnames or []
        elif path.suffix.lower() == ".jsonl":
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    actual_rows.append(json.loads(line))
            fieldnames = list(actual_rows[0]) if actual_rows else []

        if len(actual_rows) != output.get("rows"):
            errors.append(f"{case_id}: 补充数据实际行数不一致 {relative}")
        expected_columns = artifact_schema.get("columns", [])
        if expected_columns and fieldnames != expected_columns:
            errors.append(f"{case_id}: 补充数据列名或顺序不一致 {relative}")
        nature = output.get("data_nature")
        if actual_rows and "data_nature" in fieldnames and any(row.get("data_nature") != nature for row in actual_rows):
            errors.append(f"{case_id}: 补充数据行级性质不一致 {relative}")
    return errors


def validate_case(
    item: dict,
    ledger_ids: set[str],
    *,
    require_rebuildable: bool = False,
) -> list[str]:
    errors = []
    case_ids = item_case_ids(item)
    case_id = "/".join(case_ids)
    directory = (ROOT / item["directory"]).resolve()
    if DATASET_ROOT.resolve() not in directory.parents:
        return [f"{case_id}: 目录越界 {directory}"]
    is_lab = all(re.fullmatch(r"[PSL]\d{2}", value) for value in case_ids)
    for name in (REQUIRED_LAB if is_lab else REQUIRED_PRODUCT):
        if not (directory / name).is_file():
            errors.append(f"{case_id}: 缺少 {name}")
    if errors:
        return errors

    source = json.loads((directory / "source.json").read_text(encoding="utf-8"))
    schema = json.loads((directory / "schema.json").read_text(encoding="utf-8"))
    errors.extend(validate_source_lineage(case_id, source))
    errors.extend(validate_reproducibility_status(case_id, item, source))
    errors.extend(
        validate_input_files(
            case_id,
            directory,
            source,
            require_rebuildable=require_rebuildable,
        )
    )
    if not is_lab and source.get("transform_status") != "derived-verified":
        errors.append(f"{case_id}: transform_status 未验证")
    if set(item["source_ids"]) - ledger_ids:
        errors.append(f"{case_id}: 来源 ID 不在账本")
    if not set(item["source_ids"]).issubset({source_item["id"] for source_item in source["sources"]}):
        errors.append(f"{case_id}: source.json 缺少来源")
    errors.extend(validate_supplemental_outputs(case_id, directory, source, schema))

    primary_files = item.get("primary_files")
    required_checksum_names = {"README.md", "source.json", "schema.json"}
    if isinstance(primary_files, list):
        required_checksum_names.update(str(name) for name in primary_files)
    else:
        required_checksum_names.add(str(item.get("primary_file", "case.csv")))
    errors.extend(validate_checksums(case_id, directory, required_checksum_names))
    if list(directory.rglob("*.part")):
        errors.append(f"{case_id}: 存在未完成下载")

    if isinstance(primary_files, list):
        errors.extend(validate_grouped_contract(item, case_ids, directory, schema))
        return errors

    primary_file = item.get("primary_file", "case.csv")
    primary_path = (directory / primary_file).resolve()
    if directory not in primary_path.parents or not primary_path.is_file():
        errors.append(f"{case_id}: 主数据文件无效 {primary_file}")
        return errors
    if schema.get("row_count") != item.get("row_count") or item.get("row_count", 0) <= 0:
        errors.append(f"{case_id}: manifest/schema 行数不一致")
    if sha256(primary_path) != item.get("sha256"):
        errors.append(f"{case_id}: {primary_file} 哈希不一致")

    with primary_path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        rows = list(reader)
        fieldnames = reader.fieldnames or []
    if len(rows) != item["row_count"]:
        errors.append(f"{case_id}: CSV 实际行数 {len(rows)} != {item['row_count']}")
    errors.extend(validate_csv_contract({**item, "case_id": case_id}, schema, fieldnames, rows))
    if case_id == "05" and (directory / "raw").exists():
        errors.append("05: 医学案例不应包含 PIC raw 目录")
    if case_id == "08" and any(row.get("row_level_link_to_sensor") not in (None, "False", "false", "0") for row in rows):
        errors.append("08: 两来源被伪造成行级关联")
    if case_id == "10" and any(row.get("allegation_verified") not in ("False", "false", "0") for row in rows):
        errors.append("10: 投诉被标记为已核验事实")
    if case_id == "11" and "body_retained" in fieldnames and any(row.get("body_retained") not in ("False", "false", "0") for row in rows):
        errors.append("11: issue 正文进入课程子集")
    if case_id == "12" and any(row.get("usability_decision_allowed") not in ("False", "false", "0") for row in rows):
        errors.append("12: 温度数据被允许自动决定可用性")
    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="验证课程数据合同、哈希与高风险边界")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--case", action="append")
    group.add_argument("--all", action="store_true")
    parser.add_argument(
        "--require-rebuildable",
        action="store_true",
        help="要求所有声明的重建输入在案例目录中存在且符合回执",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    ledger_ids = {source["id"] for source in ledger["sources"]}
    requested = set(args.case or [])
    selected = (
        manifest["datasets"]
        if args.all
        else [item for item in manifest["datasets"] if requested.intersection(item_case_ids(item))]
    )
    errors = []
    blocked_rebuilds = 0
    for item in selected:
        source_path = ROOT / item["directory"] / "source.json"
        if source_path.is_file():
            source = json.loads(source_path.read_text(encoding="utf-8"))
            if source.get("rebuild_status") == BLOCKED_REBUILD_STATUS:
                blocked_rebuilds += 1
        errors.extend(
            validate_case(
                item,
                ledger_ids,
                require_rebuildable=args.require_rebuildable,
            )
        )
    if errors:
        print(f"DATASET VALIDATION FAILED blocked_rebuilds={blocked_rebuilds}")
        for error in errors:
            print(f"- {error}")
        return 1
    print(
        f"DATASET VALIDATION PASSED datasets={len(selected)} "
        f"cases={sum(len(item_case_ids(item)) for item in selected)} "
        f"records={sum(item.get('row_count', item.get('record_count', 0)) for item in selected)} "
        f"blocked_rebuilds={blocked_rebuilds}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
