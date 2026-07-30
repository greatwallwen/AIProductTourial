import hashlib
import json
from pathlib import Path

from tools import validate_datasets
from tools.validate_datasets import (
    build_parser,
    validate_csv_contract,
    validate_input_files,
    validate_reproducibility_status,
    validate_supplemental_outputs,
)


def test_csv_contract_checks_manifest_schema_and_actual_columns() -> None:
    item = {"case_id": "05", "column_count": 3}
    schema = {"columns": [{"name": "event_id"}, {"name": "privacy_scope"}, {"name": "clinical_decision_allowed"}]}
    rows = [{"event_id": "EVT-1", "privacy_scope": "operational_only", "clinical_decision_allowed": "False"}]

    assert validate_csv_contract(item, schema, list(rows[0]), rows) == []

    errors = validate_csv_contract({**item, "column_count": 4}, schema, list(rows[0]), rows)
    assert any("manifest/schema/CSV 列数不一致" in error for error in errors)


def test_medical_case_rejects_scope_clinical_and_sensitive_columns() -> None:
    item = {"case_id": "05", "column_count": 4}
    schema = {"columns": [
        {"name": "event_id"},
        {"name": "privacy_scope"},
        {"name": "clinical_decision_allowed"},
        {"name": "diagnosis"},
    ]}
    rows = [{
        "event_id": "EVT-1",
        "privacy_scope": "clinical_record",
        "clinical_decision_allowed": "True",
        "diagnosis": "not allowed",
    }]

    errors = validate_csv_contract(item, schema, list(rows[0]), rows)
    assert any("禁用字段" in error and "diagnosis" in error for error in errors)
    assert any("privacy_scope 必须全部为 operational_only" in error for error in errors)
    assert any("clinical_decision_allowed 必须全部为 False" in error for error in errors)


def test_medical_case_rejects_common_sensitive_aliases() -> None:
    aliases = ["full_name", "birth_date", "patient_identifier", "diagnostic_text"]
    fieldnames = ["event_id", "privacy_scope", "clinical_decision_allowed", *aliases]
    item = {"case_id": "05", "column_count": len(fieldnames)}
    schema = {"columns": [{"name": name} for name in fieldnames]}
    row = {name: "redacted" for name in fieldnames}
    row.update({"privacy_scope": "operational_only", "clinical_decision_allowed": "False"})

    errors = validate_csv_contract(item, schema, fieldnames, [row])

    sensitive_error = next(error for error in errors if "禁用字段" in error)
    for alias in aliases:
        assert alias in sensitive_error


def test_supplemental_output_requires_matching_hash_rows_schema_and_nature(tmp_path) -> None:
    artifact = tmp_path / "operational-evidence.csv"
    artifact.write_text(
        "event_id,data_nature\nEV-1,deterministic-synthetic-cn-operations\nEV-2,deterministic-synthetic-cn-operations\n",
        encoding="utf-8",
    )
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    source = {
        "sources": [{"id": "COURSE-OPS-TEST"}],
        "supplemental_outputs": [{
            "source_id": "COURSE-OPS-TEST",
            "path": "operational-evidence.csv",
            "rows": 2,
            "sha256": digest,
            "data_nature": "deterministic-synthetic-cn-operations",
        }],
    }
    schema = {
        "supplemental_artifacts": [{
            "path": "operational-evidence.csv",
            "row_count": 2,
            "data_nature": "deterministic-synthetic-cn-operations",
            "source_ids": ["COURSE-OPS-TEST"],
            "columns": ["event_id", "data_nature"],
        }],
    }

    assert validate_supplemental_outputs("07", tmp_path, source, schema) == []

    source["supplemental_outputs"][0]["sha256"] = "0" * 64
    errors = validate_supplemental_outputs("07", tmp_path, source, schema)
    assert any("补充数据哈希不一致" in error for error in errors)


def test_supplemental_output_rejects_path_escape_and_unlisted_source(tmp_path) -> None:
    source = {
        "sources": [{"id": "KNOWN"}],
        "supplemental_outputs": [{
            "source_id": "UNKNOWN",
            "path": "../outside.csv",
            "rows": 1,
            "sha256": "0" * 64,
            "data_nature": "synthetic",
        }],
    }
    errors = validate_supplemental_outputs("07", tmp_path, source, {"supplemental_artifacts": []})
    assert any("补充数据路径越界" in error for error in errors)
    assert any("补充数据来源未声明" in error for error in errors)


def test_case_11_requires_three_gate_families_without_issue_body() -> None:
    fieldnames = ["gate", "metric_value", "threshold", "sample_size", "data_nature"]
    item = {"case_id": "11", "column_count": len(fieldnames)}
    schema = {"columns": [{"name": name} for name in fieldnames]}
    rows = [
        {
            "gate": gate,
            "metric_value": "0.9",
            "threshold": "0.8",
            "sample_size": "100",
            "data_nature": "public-model-metadata-plus-deterministic-enterprise-evaluation",
        }
        for gate in ("risk", "fairness", "safety")
    ]

    assert validate_csv_contract(item, schema, fieldnames, rows) == []

    errors = validate_csv_contract(item, schema, fieldnames, rows[:1])
    assert any("risk/fairness/safety 三类门禁" in error for error in errors)


def test_case_13_rejects_reference_linkage_and_automatic_repair() -> None:
    fieldnames = [
        "intake_id",
        "row_level_link_to_reference",
        "automatic_repair_allowed",
        "allowed_action",
    ]
    item = {"case_id": "13", "column_count": len(fieldnames)}
    schema = {"columns": [{"name": name} for name in fieldnames]}
    rows = [{
        "intake_id": "CN-AS-001",
        "row_level_link_to_reference": "True",
        "automatic_repair_allowed": "True",
        "allowed_action": "repair",
    }]

    errors = validate_csv_contract(item, schema, fieldnames, rows)

    assert any("13: 公开参考与中国接车记录不得行级关联" in error for error in errors)
    assert any("13: 不得自动维修" in error for error in errors)


def test_case_15_rejects_causal_and_automatic_scrap_claims() -> None:
    fieldnames = [
        "wafer_id",
        "causal_root_cause_allowed",
        "automatic_scrap_allowed",
        "allowed_action",
    ]
    item = {"case_id": "15", "column_count": len(fieldnames)}
    schema = {"columns": [{"name": name} for name in fieldnames]}
    rows = [{
        "wafer_id": "SECOM-0001",
        "causal_root_cause_allowed": "True",
        "automatic_scrap_allowed": "True",
        "allowed_action": "scrap",
    }]

    errors = validate_csv_contract(item, schema, fieldnames, rows)

    assert any("15: 传感器关联不得写成根因" in error for error in errors)
    assert any("15: 不得自动报废晶圆" in error for error in errors)


def test_case_16_and_20_reject_automatic_field_actions() -> None:
    contracts = [
        (
            "16",
            ["turbine_id", "manual_inspection_only", "allowed_action"],
            {
                "turbine_id": "1",
                "manual_inspection_only": "False",
                "allowed_action": "dispatch_crew",
            },
            "16: 不得自动派发登检",
        ),
        (
            "20",
            ["station_id", "automatic_control_allowed", "allowed_action"],
            {
                "station_id": "1",
                "automatic_control_allowed": "True",
                "allowed_action": "change_setpoint",
            },
            "20: 不得自动控制电站",
        ),
    ]

    for case_id, fieldnames, row, expected in contracts:
        item = {"case_id": case_id, "column_count": len(fieldnames)}
        schema = {"columns": [{"name": name} for name in fieldnames]}
        errors = validate_csv_contract(item, schema, fieldnames, [row])
        assert any(expected in error for error in errors)


def test_source_lineage_rejects_fields_declared_as_both_source_and_derived() -> None:
    validate_source_lineage = getattr(validate_datasets, "validate_source_lineage", None)
    assert callable(validate_source_lineage), "source lineage validator is missing"
    source = {
        "generation": {
            "field_lineage": {
                "source_facts": ["sensor_value", "quality_label"],
                "derived_fields": ["quality_label", "review_state"],
            }
        }
    }

    errors = validate_source_lineage("15", source)

    assert errors == ["15: 字段同时声明为源事实和派生字段 quality_label"]


def test_reproducibility_status_is_backward_compatible_and_aligned() -> None:
    assert validate_reproducibility_status("01", {}, {}) == []

    item = {
        "materialized_status": "verified",
        "rebuild_status": "blocked_missing_inputs",
    }
    source = dict(item)
    assert validate_reproducibility_status("13", item, source) == []

    errors = validate_reproducibility_status(
        "13",
        {**item, "rebuild_status": "verified"},
        source,
    )
    assert errors == ["13: manifest/source rebuild_status 不一致"]


def test_blocked_missing_inputs_pass_snapshot_validation_but_fail_strict(tmp_path) -> None:
    source = {
        "rebuild_status": "blocked_missing_inputs",
        "input_files": [{
            "path": "raw/missing.csv",
            "role": "test input",
            "bytes": 10,
            "sha256": "0" * 64,
        }],
    }

    assert validate_input_files("13", tmp_path, source) == []
    errors = validate_input_files("13", tmp_path, source, require_rebuildable=True)
    assert errors == ["13: 重建输入缺失 raw/missing.csv"]

    source["rebuild_status"] = "verified"
    assert validate_input_files("13", tmp_path, source) == [
        "13: 重建输入缺失 raw/missing.csv"
    ]


def test_present_input_must_match_declared_size_and_sha256(tmp_path) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    input_path = raw / "input.csv"
    input_path.write_bytes(b"a,b\n1,2\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    source = {
        "rebuild_status": "blocked_missing_inputs",
        "input_files": [{
            "path": "raw/input.csv",
            "bytes": input_path.stat().st_size,
            "sha256": digest.upper(),
        }],
    }

    assert validate_input_files("13", tmp_path, source) == []

    source["input_files"][0]["bytes"] += 1
    source["input_files"][0]["sha256"] = "f" * 64
    errors = validate_input_files("13", tmp_path, source)
    assert any("重建输入字节数不一致" in error for error in errors)
    assert any("重建输入哈希不一致" in error for error in errors)


def test_input_audit_rejects_malformed_and_escaping_paths(tmp_path) -> None:
    assert validate_input_files("13", tmp_path, {"input_files": {}}) == [
        "13: input_files 必须为数组"
    ]
    source = {
        "rebuild_status": "blocked_missing_inputs",
        "input_files": [
            {"path": "../outside.csv", "bytes": 1, "sha256": "0" * 64},
            {"path": "", "bytes": 1, "sha256": "0" * 64},
        ],
    }
    errors = validate_input_files("13", tmp_path, source)
    assert any("重建输入路径越界" in error for error in errors)
    assert any("缺少 path" in error for error in errors)


def test_validator_parser_exposes_strict_rebuildability_gate() -> None:
    args = build_parser().parse_args(["--all", "--require-rebuildable"])

    assert args.all is True
    assert args.require_rebuildable is True


def test_strict_gate_rejects_blocked_status_even_without_declared_inputs(tmp_path) -> None:
    source = {
        "rebuild_status": "blocked_missing_inputs",
        "input_files": [],
    }

    assert validate_input_files("13", tmp_path, source) == []
    assert validate_input_files("13", tmp_path, source, require_rebuildable=True) == [
        "13: rebuild_status 仍为 blocked_missing_inputs"
    ]


def test_recovery_catalog_records_only_blocked_source_identifiers_for_cases_13_20() -> None:
    root = Path(__file__).resolve().parents[1]
    downloads = json.loads((root / "dataset" / "source-downloads.json").read_text(encoding="utf-8"))

    for case_id in (str(value) for value in range(13, 21)):
        records = downloads["cases"][case_id]
        assert records
        assert all(set(record) == {"source_id", "recovery_status"} for record in records)
        assert all(record["recovery_status"] == "blocked_missing_inputs" for record in records)
