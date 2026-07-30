from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
CONTRACT = Path(__file__).with_name("contracts.json")
DATASET_ROOT = ROOT / "dataset"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def run_python(script: Path, *arguments: str) -> dict[str, Any]:
    completed = subprocess.run(
        [sys.executable, "-B", str(script), *arguments],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return {
        "command": " ".join(["python", "-B", relative(script), *arguments]),
        "exit_code": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def metric(metrics: dict[str, Any], metric_id: str) -> dict[str, Any]:
    return next(item for item in metrics["metrics"] if item["metric_id"] == metric_id)


def l01(output: Path) -> dict[str, Any]:
    case_dir = output / "L01"
    case_dir.mkdir(parents=True, exist_ok=True)
    source = DATASET_ROOT / "02-member-value-experiment" / "case.csv"
    profile_json = case_dir / "profile.json"
    profile_md = case_dir / "profile.md"
    metrics_json = case_dir / "metrics.json"
    brief_md = case_dir / "business-brief.md"

    calls = [
        run_python(
            ROOT / "code" / "skills" / "data-profile" / "scripts" / "profile_csv.py",
            "--input", str(source),
            "--allowed-root", str(DATASET_ROOT),
            "--json-output", str(profile_json),
            "--markdown-output", str(profile_md),
        ),
        run_python(
            ROOT / "code" / "skills" / "metric-brief" / "scripts" / "build_member_brief.py",
            "--input", str(source),
            "--allowed-root", str(DATASET_ROOT),
            "--coupon-amount-cny", "8",
            "--target-segment", "成长",
            "--metrics-output", str(metrics_json),
            "--brief-output", str(brief_md),
        ),
    ]
    profile = read_json(profile_json)
    metrics = read_json(metrics_json)
    member_count = metric(metrics, "member_count")
    budget = metric(metrics, "target_full_issue_budget")
    revenue = metric(metrics, "historical_revenue")
    recency = metric(metrics, "purchase_recency")
    checks = [
        {"id": "profile-complete", "passed": profile["status"] == "complete" and profile["rows"] == 5000},
        {"id": "member-count", "passed": member_count["value"] == 5000},
        {"id": "coupon-ceiling", "passed": budget["value"] == 10000.0 and budget["unit"] == "CNY"},
        {"id": "missing-metrics-not-invented", "passed": revenue["status"] == "not_calculable" and recency["status"] == "not_calculable"},
    ]
    if not all(item["passed"] for item in checks):
        raise ValueError("L01 acceptance check failed")
    transitions = [
        {"step": 1, "state": "observe", "result": f"完整扫描 {profile['rows']} 行、{profile['column_count']} 列。"},
        {"step": 2, "state": "choose", "result": "选择 data-profile 后再调用 metric-brief；不先写经营结论。"},
        {"step": 3, "state": "act", "result": "计算会员数、分层、购买次数代理与 8 元券名义发放上限。"},
        {"step": 4, "state": "check", "result": "发现源表缺少交易金额和绝对时间，收入与复购间隔不可计算。"},
        {"step": 5, "state": "revise", "result": "保留可算指标，将不可算指标写入限制条件。"},
        {"step": 6, "state": "completed", "result": "四项硬检查通过，停止循环。"},
    ]
    return {
        "schema_version": "2.0",
        "lab_id": "L01",
        "objective": "从会员明细生成一页可复核经营简报",
        "state": "completed",
        "stop_reason": "acceptance_passed",
        "capability_sequence": ["data-profile", "metric-brief"],
        "input_artifacts": [relative(source)],
        "output_artifacts": [relative(profile_json), relative(profile_md), relative(metrics_json), relative(brief_md)],
        "facts": {"rows": profile["rows"], "members": member_count["value"], "coupon_face_value_ceiling_cny": budget["value"]},
        "checks": checks,
        "calls": calls,
        "transitions": transitions,
        "human_gate": None,
    }


def l02(output: Path) -> dict[str, Any]:
    case_dir = output / "L02"
    case_dir.mkdir(parents=True, exist_ok=True)
    brief = ROOT / "code" / "skills" / "poster-recipe" / "examples" / "rainy-bookstore-brief.json"
    recipes_json = case_dir / "poster-recipes.json"
    poster_svg = case_dir / "poster.svg"
    call = run_python(
        ROOT / "code" / "skills" / "poster-recipe" / "scripts" / "build_poster.py",
        "--input", str(brief),
        "--allowed-root", str(brief.parent),
        "--recipe-output", str(recipes_json),
        "--svg-output", str(poster_svg),
    )
    recipes = read_json(recipes_json)
    items = recipes["recipes"]
    checks = [
        {"id": "three-directions", "passed": len(items) == 3 and len({item["id"] for item in items}) == 3},
        {"id": "selection-rationale", "passed": bool(recipes.get("selected_recipe_id")) and bool(recipes.get("selection_reason"))},
        {"id": "editable-local-preview", "passed": poster_svg.exists() and "<svg" in poster_svg.read_text(encoding="utf-8")},
        {"id": "provider-boundary", "passed": recipes["image_provider_called"] is False and recipes["image_provider_receipt"] is None},
    ]
    if not all(item["passed"] for item in checks):
        raise ValueError("L02 acceptance check failed")
    transitions = [
        {"step": 1, "state": "observe", "result": "读取受众、标题、必备文字、画面元素和禁用项。"},
        {"step": 2, "state": "choose", "result": "选择 poster-recipe，限定为三套方向与一个可编辑本地预览。"},
        {"step": 3, "state": "act", "result": "生成三套构图配方和 SVG。"},
        {"step": 4, "state": "check", "result": "检查方向差异、文字完整性、SVG 可编辑性和 Provider 边界。"},
        {"step": 5, "state": "revise", "result": "自动选择只作为推荐，不替代人的视觉取舍。"},
        {"step": 6, "state": "waiting_human", "result": "结构检查通过；停在最终视觉选择。"},
    ]
    return {
        "schema_version": "2.0",
        "lab_id": "L02",
        "objective": "把雨天旧书店简报变成三套可比较的海报方向",
        "state": "waiting_human",
        "stop_reason": "visual_choice_required",
        "capability_sequence": ["poster-recipe"],
        "input_artifacts": [relative(brief)],
        "output_artifacts": [relative(recipes_json), relative(poster_svg)],
        "facts": {"candidate_count": len(items), "recommended": recipes["selected_recipe_id"], "provider_called": False},
        "checks": checks,
        "calls": [call],
        "transitions": transitions,
        "human_gate": "从三套方向中确认一套，或说明需要改变的视觉变量。",
    }


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value)


def l03(output: Path) -> dict[str, Any]:
    case_dir = output / "L03"
    case_dir.mkdir(parents=True, exist_ok=True)
    source = DATASET_ROOT / "09-metro-agentic-rag" / "case.csv"
    knowledge_path = DATASET_ROOT / "09-metro-agentic-rag" / "knowledge.jsonl"
    start = parse_time("2020-04-17 23:57:30")
    end = parse_time("2020-04-18 00:02:30")
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [row for row in csv.DictReader(handle) if start <= parse_time(row["timestamp"]) <= end]
    knowledge = [json.loads(line) for line in knowledge_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    selected = [item for item in knowledge if item["id"] in {"UCI-791-SOURCE", "UCI-791-FIELDS", "COURSE-09-INSPECTION", "COURSE-09-APPROVAL"}]

    def stats(field: str) -> dict[str, float]:
        values = [float(row[field]) for row in rows]
        return {"min": min(values), "max": max(values), "mean": round(sum(values) / len(values), 6)}

    packet = {
        "schema_version": "1.0",
        "title": "MetroPT-3 固定窗口现场检查申请",
        "window": {"from": rows[0]["timestamp"], "to": rows[-1]["timestamp"], "rows": len(rows)},
        "observations": {field: stats(field) for field in ["TP2", "TP3", "Oil_temperature", "Motor_current"]},
        "references": [{"id": item["id"], "source_id": item["source_id"], "citation": item["citation"], "boundary": item["boundary"]} for item in selected],
        "requested_action": "由有权限的主管决定是否创建现场检查工单",
        "prohibited_actions": ["自动停机", "自动维修", "故障诊断", "调用设备控制工具"],
        "status": "waiting_human",
        "data_nature": "public-derived-sensor-window-plus-course-policy",
    }
    packet_path = case_dir / "approval-packet.json"
    packet_path.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    checks = [
        {"id": "fixed-window", "passed": len(rows) == 25 and rows[0]["timestamp"] == "2020-04-17 23:57:36" and rows[-1]["timestamp"] == "2020-04-18 00:02:25"},
        {"id": "source-and-policy-separated", "passed": {item["source_id"] for item in selected} == {"DATA-09", "COURSE-POLICY-09"}},
        {"id": "no-control-authority", "passed": all(row["maintenance_action_allowed"] == "False" for row in rows)},
        {"id": "no-diagnosis", "passed": "diagnosis" not in packet and packet["status"] == "waiting_human"},
    ]
    if not all(item["passed"] for item in checks):
        raise ValueError("L03 acceptance check failed")
    transitions = [
        {"step": 1, "state": "observe", "result": "从公开数据固定窗口读取 25 条传感记录。"},
        {"step": 2, "state": "choose", "result": "只检索数据字段说明、课程检查程序和审批策略。"},
        {"step": 3, "state": "act", "result": "计算压力、油温和电流的窗口统计。"},
        {"step": 4, "state": "check", "result": "数据没有维修结果，且 maintenance_action_allowed 全为 False。"},
        {"step": 5, "state": "revise", "result": "删除任何根因或维修措辞，只整理检查申请。"},
        {"step": 6, "state": "waiting_human", "result": "审批包完成；自动动作停止。"},
    ]
    return {
        "schema_version": "2.0",
        "lab_id": "L03",
        "objective": "基于公开压缩机窗口准备现场检查申请，而不是自动诊断或控制设备",
        "state": "waiting_human",
        "stop_reason": "permission_required",
        "capability_sequence": ["fixed-window-reader", "bounded-retrieval", "approval-packet"],
        "input_artifacts": [relative(source), relative(knowledge_path)],
        "output_artifacts": [relative(packet_path)],
        "facts": packet["window"],
        "checks": checks,
        "calls": [],
        "transitions": transitions,
        "human_gate": packet["requested_action"],
    }


RUNNERS = {"L01": l01, "L02": l02, "L03": l03}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a real, bounded course Loop")
    parser.add_argument("--lab", required=True, choices=sorted(RUNNERS))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    contract = read_json(CONTRACT)
    case = next(item for item in contract["cases"] if item["id"] == args.lab)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    payload = RUNNERS[args.lab](output)
    if payload["state"] != case["terminal"] or payload["stop_reason"] != case["stopReason"]:
        raise ValueError("runtime result does not match the Loop contract")
    target = output / case["artifact"]
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"lab": args.lab, "state": payload["state"], "stop_reason": payload["stop_reason"], "artifact": relative(target)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
