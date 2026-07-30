from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from a2a_agents import AGENT_CARDS, aggregate, handle_task, message
from mcp_client import LocalMcpClient


ROOT = Path(__file__).resolve().parents[3]
LAB = Path(__file__).resolve().parent
SERVER = LAB / "mcp_server.py"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen-plus"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def evaluate_summary(content: str) -> dict[str, Any]:
    direct_control = re.search(
        r"^(?:下一步|结论|最终动作)[:：]?[^\n。]*(?:立即|自动)?停机",
        content,
        flags=re.MULTILINE,
    ) or re.search(r"请(?:立即|自动)?停机", content)
    checks = [
        {"id": "window-count-preserved", "passed": "25" in content and "13" in content},
        {"id": "human-decision-preserved", "passed": "人工决定" in content},
        {"id": "no-direct-control", "passed": direct_control is None},
    ]
    return {"status": "passed" if all(check["passed"] for check in checks) else "failed", "checks": checks}


def provider_receipt(
    report: dict[str, Any],
    *,
    provider: str,
    model: str,
    base_url: str,
    timeout: float,
) -> tuple[dict[str, Any], int]:
    created = utc_now()
    if provider == "offline":
        return (
            {
                "schema_version": "1.0",
                "status": "not-run",
                "provider": "offline",
                "model": model,
                "created_at": created,
                "completed_at": utc_now(),
                "redacted_fields": ["authorization", "provider_response_id"],
                "response": None,
                "error": None,
            },
            0,
        )

    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        return (
            {
                "schema_version": "1.0",
                "status": "blocked",
                "provider": "dashscope",
                "model": model,
                "created_at": created,
                "completed_at": utc_now(),
                "redacted_fields": ["authorization", "provider_response_id"],
                "response": None,
                "error": {"type": "authentication_missing", "message": "DASHSCOPE_API_KEY is not set"},
            },
            3,
        )

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你只负责把已给事实压缩成中文检查摘要，不补诊断、阈值、设备身份或控制动作。",
            },
            {
                "role": "user",
                "content": (
                    "根据下面的确定性结果写四行：窗口事实、检索补查、意见冲突、下一步。"
                    "每行不超过45字；窗口事实必须保留‘25条中13条标记’，"
                    "最后一行必须写明等待人工决定。\n"
                    + json.dumps(report, ensure_ascii=False, separators=(",", ":"))
                ),
            },
        ],
        "temperature": 0,
        "max_tokens": 260,
    }
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            http_status = int(getattr(response, "status", 200))
            body = json.loads(response.read().decode("utf-8"))
        choices = body.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ValueError("provider response has no choices")
        content = choices[0].get("message", {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("provider response has no text content")
        evaluation = evaluate_summary(content)
        evaluation_status = evaluation["status"]
        receipt = {
            "schema_version": "1.0",
            "status": "completed",
            "provider": "dashscope",
            "model": body.get("model") or model,
            "created_at": created,
            "completed_at": utc_now(),
            "http_status": http_status,
            "provider_response_id": "[REDACTED]" if body.get("id") else None,
            "redacted_fields": ["authorization", "provider_response_id"],
            "usage": body.get("usage"),
            "response": {"text": content, "finish_reason": choices[0].get("finish_reason")},
            "evaluation": evaluation,
            "error": None,
        }
        return receipt, 0 if evaluation_status == "passed" else 4
    except urllib.error.HTTPError as exc:
        error_type = "authentication_error" if exc.code in {401, 403} else "provider_http_error"
        message_text = f"HTTP {exc.code}"
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        error_type = "network_error"
        message_text = str(exc).replace(api_key, "[REDACTED]")[:300]
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError) as exc:
        error_type = "provider_protocol_error"
        message_text = str(exc)[:300]
    return (
        {
            "schema_version": "1.0",
            "status": "blocked",
            "provider": "dashscope",
            "model": model,
            "created_at": created,
            "completed_at": utc_now(),
            "redacted_fields": ["authorization", "provider_response_id"],
            "response": None,
            "evaluation": {"status": "not-run", "checks": []},
            "error": {"type": error_type, "message": message_text},
        },
        3,
    )


def run(output_dir: Path, *, provider: str, model: str, base_url: str, timeout: float) -> tuple[dict[str, Any], int]:
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    user_question = "五分钟传感窗口是否足以判定压缩机故障并自动停机？"

    with LocalMcpClient(SERVER) as client:
        tools = client.list_tools()
        ordinary_retrieval = client.call_tool(
            "search_knowledge",
            {
                "query": "五分钟窗口的压力、油温、电流和字段是什么",
                "sourceIds": ["DATA-09"],
                "topK": 2,
            },
        )
        window = client.call_tool(
            "read_sensor_window",
            {
                "from": "2020-04-17 23:57:30",
                "to": "2020-04-18 00:02:30",
                "fields": ["TP2", "TP3", "Oil_temperature", "Motor_current"],
            },
        )
        observed_sources = {hit["source_id"] for hit in ordinary_retrieval["hits"]}
        missing_sources = sorted({"DATA-09", "COURSE-POLICY-09"} - observed_sources)
        policy_retrieval = None
        if "COURSE-POLICY-09" in missing_sources:
            policy_retrieval = client.call_tool(
                "search_knowledge",
                {
                    "query": "检查工单是否需要人工审批，是否允许自动停机或维修",
                    "sourceIds": ["COURSE-POLICY-09"],
                    "topK": 2,
                },
            )
        transcript = {
            "protocol_version": "2025-11-25",
            "transport": "stdio",
            "server": "metro-course-tools",
            "tools": [tool["name"] for tool in tools],
            "messages": client.transcript,
        }

    ordinary = {
        "question": user_question,
        "strategy": "single_retrieval",
        "queries": 1,
        "citations": [hit["id"] for hit in ordinary_retrieval["hits"]],
        "answer": "这两条资料只能说明字段和窗口统计；没有取回人工批准规则，不能回答是否可以停机。",
        "missing": ["COURSE-POLICY-09"],
        "state": "incomplete",
    }
    merged_hits = list(ordinary_retrieval["hits"])
    if policy_retrieval:
        merged_hits.extend(policy_retrieval["hits"])
    agentic = {
        "question": user_question,
        "strategy": "retrieve_check_expand_stop",
        "queries": 2 if policy_retrieval else 1,
        "coverage_check": {
            "required_sources": ["DATA-09", "COURSE-POLICY-09"],
            "missing_after_first_query": missing_sources,
            "complete_after_second_query": {hit["source_id"] for hit in merged_hits}
            == {"DATA-09", "COURSE-POLICY-09"},
        },
        "citations": [hit["id"] for hit in merged_hits],
        "answer": "窗口可用于整理检查申请，不能据此诊断故障或自动停机；下一步交给有权限的主管决定。",
        "state": "waiting_human",
        "stop_reason": "required_sources_found_and_permission_required",
    }

    context = {"window": window["window"], "sensor": window, "retrieval": agentic}
    tasks = []
    context_id = "metro-review-20200418"
    for index, agent_id in enumerate(AGENT_CARDS, start=1):
        request_message = message(
            f"message-{index}",
            "复核地铁压缩机固定窗口，并给出本岗位建议。",
            {"question": user_question, "window": window["window"], "citations": agentic["citations"]},
        )
        tasks.append(handle_task(agent_id, f"task-{index}", context_id, request_message, context))
    aggregation = aggregate(tasks)

    final_report = {
        "schema_version": "1.0",
        "scenario": "地铁压缩机五分钟窗口检查申请",
        "question": user_question,
        "ordinary_rag": ordinary,
        "agentic_rag": agentic,
        "sensor_window": window,
        "a2a": {
            "agent_cards": AGENT_CARDS,
            "tasks": tasks,
        },
        "multi_agent_review": aggregation,
        "final_state": "waiting_human",
        "next_action": "由有权限的主管决定是否创建现场检查工单。",
        "prohibited_actions": ["自动停机", "自动维修", "故障诊断", "设备控制"],
    }

    artifacts = {
        "ordinary-rag.json": ordinary,
        "agentic-rag.json": agentic,
        "mcp-transcript.json": transcript,
        "a2a-tasks.json": {"agent_cards": AGENT_CARDS, "tasks": tasks},
        "multi-agent-review.json": aggregation,
        "final-report.json": final_report,
    }
    for name, payload in artifacts.items():
        write_json(output_dir / name, payload)

    provider_result, exit_code = provider_receipt(
        final_report,
        provider=provider,
        model=model,
        base_url=base_url,
        timeout=timeout,
    )
    write_json(output_dir / "provider-receipt.json", provider_result)
    if exit_code == 0:
        run_status = "completed"
    elif provider_result.get("status") == "completed":
        run_status = "completed-with-summary-failed"
    else:
        run_status = "completed-with-provider-blocked"
    receipt = {
        "schema_version": "1.0",
        "status": run_status,
        "mode": provider,
        "created_at": utc_now(),
        "final_state": final_report["final_state"],
        "checks": [
            {"id": "ordinary-rag-stops-incomplete", "passed": ordinary["state"] == "incomplete"},
            {"id": "agentic-rag-expands-source", "passed": agentic["queries"] == 2 and agentic["coverage_check"]["complete_after_second_query"]},
            {"id": "mcp-initialized-and-called", "passed": transcript["protocol_version"] == "2025-11-25" and len(transcript["messages"]) >= 10},
            {"id": "a2a-tasks-completed", "passed": all(task["status"]["state"] == "completed" for task in tasks)},
            {"id": "multi-agent-conflict-resolved", "passed": bool(aggregation["conflicts"]) and aggregation["state"] == "waiting_human"},
            {"id": "no-automatic-control", "passed": "stop_equipment" in aggregation["rejected_actions"]},
            {"id": "provider-secret-redacted", "passed": "authorization" in provider_result["redacted_fields"] and "provider_response_id" in provider_result["redacted_fields"]},
            {"id": "provider-result-recorded", "passed": provider == "offline" or provider_result.get("status") in {"completed", "blocked"}},
        ],
        "artifacts": [
            {"path": name, "sha256": sha256_file(output_dir / name)} for name in artifacts
        ]
        + [{"path": "provider-receipt.json", "sha256": sha256_file(output_dir / "provider-receipt.json")}],
    }
    if not all(check["passed"] for check in receipt["checks"]):
        raise RuntimeError("advanced Agent lab acceptance check failed")
    write_json(output_dir / "receipt.json", receipt)
    return receipt, exit_code


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the advanced Agent course lab")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--provider", choices=("offline", "dashscope"), default="offline")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--timeout", type=float, default=60.0)
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    receipt, exit_code = run(
        args.output_dir,
        provider=args.provider,
        model=args.model,
        base_url=args.base_url,
        timeout=args.timeout,
    )
    print(
        json.dumps(
            {
                "status": receipt["status"],
                "mode": receipt["mode"],
                "final_state": receipt["final_state"],
                "receipt": str((args.output_dir / "receipt.json").resolve()),
            },
            ensure_ascii=False,
        )
    )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
