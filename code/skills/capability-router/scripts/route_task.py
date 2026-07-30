from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_CATALOG = Path(__file__).resolve().parents[1] / "contracts" / "capabilities.json"


def _load_object(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8-sig") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("input_must_be_json_object")
    return value


def _validate_task(task: dict[str, Any]) -> None:
    required = ("task_id", "task", "inputs", "requested_actions", "permissions")
    missing = [field for field in required if field not in task]
    if missing:
        raise ValueError("missing_fields:" + ",".join(missing))
    if not isinstance(task["task_id"], str) or not task["task_id"].strip():
        raise ValueError("invalid_task_id")
    if not isinstance(task["task"], str) or not task["task"].strip():
        raise ValueError("invalid_task")
    if not isinstance(task["inputs"], dict):
        raise ValueError("inputs_must_be_object")
    for field in ("requested_actions", "permissions"):
        value = task[field]
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            raise ValueError(f"{field}_must_be_string_array")


def _decision(
    task_id: str,
    status: str,
    selected_skill: str | None,
    reason: str,
    required_inputs: list[str] | None = None,
    stop_reason: str | None = None,
) -> dict[str, Any]:
    return {
        "task_id": task_id,
        "status": status,
        "selected_skill": selected_skill,
        "reason": reason,
        "required_inputs": required_inputs or [],
        "stop_reason": stop_reason,
    }


def route_task(task: dict[str, Any], catalog: dict[str, Any]) -> dict[str, Any]:
    _validate_task(task)
    task_id = task["task_id"].strip()
    requested = list(dict.fromkeys(task["requested_actions"]))
    permissions = set(task["permissions"])
    allowed = set(catalog.get("allowed_actions", []))
    prohibited = set(catalog.get("prohibited_actions", []))

    denied = [action for action in requested if action in prohibited or action not in allowed]
    if denied:
        return _decision(
            task_id,
            "blocked",
            None,
            "请求包含路由器永不授权的动作。",
            stop_reason="unauthorized_action:" + ",".join(denied),
        )

    ungranted = [action for action in requested if action not in permissions]
    if ungranted:
        return _decision(
            task_id,
            "blocked",
            None,
            "请求动作没有相应权限。",
            stop_reason="permission_missing:" + ",".join(ungranted),
        )

    task_text = task["task"].lower()
    ranked: list[tuple[int, int, dict[str, Any]]] = []
    for index, capability in enumerate(catalog.get("capabilities", [])):
        keywords = capability.get("keywords", [])
        score = sum(1 for keyword in keywords if str(keyword).lower() in task_text)
        if score:
            ranked.append((score, -index, capability))
    if not ranked:
        return _decision(
            task_id,
            "blocked",
            None,
            "明确能力清单中没有与该任务相符的 Skill。",
            stop_reason="no_matching_skill",
        )

    ranked.sort(reverse=True, key=lambda item: (item[0], item[1]))
    capability = ranked[0][2]
    capability_id = str(capability["id"])
    required_actions = [str(item) for item in capability.get("required_actions", [])]
    missing_permissions = [action for action in required_actions if action not in permissions]
    if missing_permissions:
        return _decision(
            task_id,
            "blocked",
            capability_id,
            f"任务最接近 {capability_id}，但执行所需权限不足。",
            stop_reason="permission_missing:" + ",".join(missing_permissions),
        )

    inputs = task["inputs"]
    required_inputs = [str(item) for item in capability.get("required_inputs", [])]
    missing_inputs = [field for field in required_inputs if field not in inputs or inputs[field] in (None, "", [])]
    if missing_inputs:
        return _decision(
            task_id,
            "blocked",
            capability_id,
            f"任务最接近 {capability_id}，但不能凭空补全输入。",
            required_inputs=missing_inputs,
            stop_reason="missing_required_inputs",
        )

    return _decision(
        task_id,
        "selected",
        capability_id,
        f"{capability_id} 是匹配任务且权限范围内的最小本地能力。",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Route a Chinese task JSON to an allowlisted Skill.")
    parser.add_argument("--input", required=True, help="Task JSON path")
    parser.add_argument("--catalog", default=str(DEFAULT_CATALOG), help="Capability catalog path")
    parser.add_argument("--output", help="Optional decision JSON path")
    args = parser.parse_args()
    try:
        task = _load_object(args.input)
        catalog = _load_object(args.catalog)
        result = route_task(task, catalog)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        result = _decision("unknown", "blocked", None, "输入合同无效。", stop_reason=str(error))

    rendered = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if result["status"] == "selected" else 2


if __name__ == "__main__":
    raise SystemExit(main())
