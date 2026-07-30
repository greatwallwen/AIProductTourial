from __future__ import annotations

from collections import Counter
from pathlib import Path
import sys

import pandas as pd


TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))

import prepare_dataset_cases as materializer  # noqa: E402


def test_case_10_uses_miit_anchor_without_claiming_real_complaints():
    frame, extra_files = materializer.transform_10()

    assert len(frame) == 1_000
    assert Counter(frame["category"]) == {
        "资费争议": 404,
        "服务争议": 393,
        "营销争议": 114,
        "其他": 89,
    }
    assert set(frame["data_nature"]) == {"deterministic-synthetic-cn-operations"}
    assert any(path.name == "public-reference.csv" for path in extra_files)


def test_case_11_contains_three_recomputable_gate_families():
    frame, extra_files = materializer.transform_11()

    assert set(frame["gate"]) == {"risk", "fairness", "safety"}
    assert frame["metric_value"].notna().all()
    assert frame["threshold"].notna().all()
    assert frame["sample_size"].gt(0).all()
    assert set(frame["data_nature"]) == {
        "public-model-metadata-plus-deterministic-enterprise-evaluation"
    }
    assert any(path.name == "candidate.json" for path in extra_files)


def test_case_12_keeps_public_benchmark_separate_from_china_operations():
    frame, extra_files = materializer.transform_12()
    benchmark_path = next(path for path in extra_files if path.name == "public-benchmark.csv")
    benchmark = pd.read_csv(benchmark_path)

    assert len(frame) == 360
    assert set(frame["data_nature"]) == {"deterministic-synthetic-cn-operations"}
    assert set(frame["reference_profile_type"]).issubset(
        {"freeze_preventive", "standard_carrier", "ambient_context"}
    )
    assert set(frame["county"]).isdisjoint(set(benchmark["site_code"]))
    assert not any(
        column in frame.columns
        for column in ("patient_id", "real_batch_id", "product_release", "usability_decision")
    )
