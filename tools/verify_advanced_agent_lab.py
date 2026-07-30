from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "code" / "labs" / "advanced-agent-lab"
OFFLINE = ROOT / "evidence" / "runtime" / "advanced-agent-lab" / "offline"
LIVE = ROOT / "evidence" / "runtime" / "advanced-agent-lab" / "qwen-plus"
CHAPTER = ROOT / "AI时代研发产品项目一体化知识库" / "03-Agent与Skill工程.md"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    errors: list[str] = []
    required_code = (
        "contract.json",
        "mcp_server.py",
        "mcp_client.py",
        "a2a_agents.py",
        "run_lab.py",
        "README.md",
        "tests/test_advanced_agent_lab.py",
    )
    for relative in required_code:
        if not (LAB / relative).is_file():
            errors.append(f"missing advanced Agent lab file: {relative}")

    for root in (OFFLINE, LIVE):
        for name in (
            "ordinary-rag.json",
            "agentic-rag.json",
            "mcp-transcript.json",
            "a2a-tasks.json",
            "multi-agent-review.json",
            "final-report.json",
            "provider-receipt.json",
            "receipt.json",
        ):
            if not (root / name).is_file():
                errors.append(f"missing runtime artifact: {root.name}/{name}")

    if not errors:
        ordinary = read_json(LIVE / "ordinary-rag.json")
        agentic = read_json(LIVE / "agentic-rag.json")
        transcript = read_json(LIVE / "mcp-transcript.json")
        a2a = read_json(LIVE / "a2a-tasks.json")
        review = read_json(LIVE / "multi-agent-review.json")
        provider = read_json(LIVE / "provider-receipt.json")
        receipt = read_json(LIVE / "receipt.json")

        if ordinary.get("state") != "incomplete" or ordinary.get("queries") != 1:
            errors.append("ordinary RAG must stop after one incomplete retrieval")
        if agentic.get("queries") != 2 or not agentic.get("coverage_check", {}).get("complete_after_second_query"):
            errors.append("Agentic RAG must expand once and cover data plus policy")
        if agentic.get("state") != "waiting_human":
            errors.append("Agentic RAG must stop at the human decision")

        methods = [
            item.get("message", {}).get("method")
            for item in transcript.get("messages", [])
            if item.get("direction") == "client_to_server"
        ]
        expected_prefix = ["initialize", "notifications/initialized", "tools/list"]
        if methods[:3] != expected_prefix or methods.count("tools/call") != 3:
            errors.append(f"unexpected MCP method sequence: {methods}")
        if transcript.get("protocol_version") != "2025-11-25":
            errors.append("MCP transcript must use protocol 2025-11-25")

        tasks = a2a.get("tasks", [])
        if len(tasks) != 3 or any(task.get("status", {}).get("state") != "completed" for task in tasks):
            errors.append("A2A must contain three completed tasks")
        if any(not task.get("history") or not task.get("artifacts") for task in tasks):
            errors.append("each A2A task must retain its message history and artifact")
        if not review.get("conflicts") or review.get("state") != "waiting_human":
            errors.append("multi-agent conflict must be explicit and end waiting for a human")
        if "stop_equipment" not in review.get("rejected_actions", []):
            errors.append("automatic stop must be rejected")

        if provider.get("status") != "completed" or provider.get("model") != "qwen-plus":
            errors.append("qwen-plus provider receipt is not completed")
        if provider.get("provider_response_id") != "[REDACTED]":
            errors.append("provider response id is not redacted")
        if provider.get("evaluation", {}).get("status") != "passed":
            errors.append("qwen-plus summary checks did not pass")
        if not isinstance(provider.get("usage", {}).get("total_tokens"), int):
            errors.append("qwen-plus receipt has no token usage")
        if any(not check.get("passed") for check in receipt.get("checks", [])):
            errors.append("live advanced Agent receipt contains a failed check")

        offline_report = OFFLINE / "final-report.json"
        live_report = LIVE / "final-report.json"
        if hashlib.sha256(offline_report.read_bytes()).digest() != hashlib.sha256(live_report.read_bytes()).digest():
            errors.append("offline and live deterministic final reports differ")

    chapter = CHAPTER.read_text(encoding="utf-8")
    for required in (
        "## A01",
        "普通 RAG",
        "Agentic RAG",
        "MCP",
        "A2A",
        "25条中13条标记",
        "等待人工决定",
        "advanced-agent-lab",
    ):
        if required not in chapter:
            errors.append(f"advanced Agent chapter missing: {required}")
    if "```mermaid" in chapter:
        errors.append("advanced Agent chapter must not use Mermaid")
    if not (ROOT / "sources" / "cards" / "advanced-agent-protocols-2026-07.md").is_file():
        errors.append("missing current MCP/A2A source card")

    sensitive_pattern = re.compile(r"sk-[a-f0-9]{20,}", re.IGNORECASE)
    for root in (LAB, OFFLINE, LIVE):
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".py", ".md", ".json", ".txt"}:
                if sensitive_pattern.search(path.read_text(encoding="utf-8", errors="ignore")):
                    errors.append(f"possible API key leaked in {path.relative_to(ROOT)}")

    if errors:
        print("ADVANCED AGENT LAB FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print(
        "ADVANCED AGENT LAB PASSED "
        "mcp_calls=3 a2a_tasks=3 rag_queries=1->2 provider=qwen-plus state=waiting_human"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
