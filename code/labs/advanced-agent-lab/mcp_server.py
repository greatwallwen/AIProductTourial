from __future__ import annotations

import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
DATASET = ROOT / "dataset" / "09-metro-agentic-rag"
KNOWLEDGE = DATASET / "knowledge.jsonl"
SENSOR_DATA = DATASET / "case.csv"
PROTOCOL_VERSION = "2025-11-25"
ALLOWED_FIELDS = {"TP2", "TP3", "Oil_temperature", "Motor_current"}


def load_knowledge() -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in KNOWLEDGE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def search_knowledge(arguments: dict[str, Any]) -> dict[str, Any]:
    query = arguments.get("query")
    source_ids = arguments.get("sourceIds")
    top_k = arguments.get("topK", 3)
    if not isinstance(query, str) or not query.strip():
        raise ValueError("query must be a non-empty string")
    if not isinstance(source_ids, list) or not source_ids or any(
        source_id not in {"DATA-09", "COURSE-POLICY-09"} for source_id in source_ids
    ):
        raise ValueError("sourceIds must select DATA-09 and/or COURSE-POLICY-09")
    if not isinstance(top_k, int) or isinstance(top_k, bool) or not 1 <= top_k <= 5:
        raise ValueError("topK must be an integer from 1 to 5")

    terms = [
        term
        for term in (
            "五分钟",
            "窗口",
            "压力",
            "油温",
            "电流",
            "字段",
            "检查",
            "审批",
            "停机",
            "人工",
            "故障",
            "维修",
        )
        if term in query
    ]
    ranked: list[tuple[int, str, dict[str, Any]]] = []
    for item in load_knowledge():
        if item["source_id"] not in source_ids:
            continue
        haystack = " ".join(
            str(item.get(field, ""))
            for field in ("title", "content", "boundary", "type")
        )
        score = sum(1 for term in terms if term in haystack)
        ranked.append((score, item["id"], item))
    ranked.sort(key=lambda entry: (-entry[0], entry[1]))
    hits = []
    for score, _, item in ranked[:top_k]:
        hits.append(
            {
                "id": item["id"],
                "source_id": item["source_id"],
                "title": item["title"],
                "content": item["content"],
                "citation": item["citation"],
                "score": score,
            }
        )
    return {"query": query, "source_ids": source_ids, "hits": hits}


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value)


def read_sensor_window(arguments: dict[str, Any]) -> dict[str, Any]:
    start_value = arguments.get("from")
    end_value = arguments.get("to")
    fields = arguments.get("fields")
    if not isinstance(start_value, str) or not isinstance(end_value, str):
        raise ValueError("from and to must be ISO date-time strings")
    if not isinstance(fields, list) or not fields or any(field not in ALLOWED_FIELDS for field in fields):
        raise ValueError(f"fields must be selected from {sorted(ALLOWED_FIELDS)}")
    start = parse_time(start_value)
    end = parse_time(end_value)
    if end <= start:
        raise ValueError("to must be later than from")
    with SENSOR_DATA.open(encoding="utf-8-sig", newline="") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if start <= parse_time(row["timestamp"]) <= end
        ]
    if not rows:
        raise ValueError("the fixed course slice contains no rows for this window")

    stats: dict[str, dict[str, float]] = {}
    for field in fields:
        values = [float(row[field]) for row in rows]
        stats[field] = {
            "min": round(min(values), 6),
            "max": round(max(values), 6),
            "mean": round(sum(values) / len(values), 6),
        }
    return {
        "window": {
            "from": rows[0]["timestamp"],
            "to": rows[-1]["timestamp"],
            "rows": len(rows),
        },
        "stats": stats,
        "known_failure_window_rows": sum(row["known_failure_window"] == "True" for row in rows),
        "maintenance_action_allowed": all(row["maintenance_action_allowed"] == "True" for row in rows),
        "data_nature": rows[0]["data_nature"],
    }


TOOLS = [
    {
        "name": "search_knowledge",
        "description": "在地铁压缩机课程语料中按来源范围检索资料。",
        "inputSchema": {
            "type": "object",
            "required": ["query", "sourceIds", "topK"],
            "properties": {
                "query": {"type": "string"},
                "sourceIds": {
                    "type": "array",
                    "items": {"enum": ["DATA-09", "COURSE-POLICY-09"]},
                },
                "topK": {"type": "integer", "minimum": 1, "maximum": 5},
            },
        },
    },
    {
        "name": "read_sensor_window",
        "description": "读取课程固定传感器切片的指定时间窗并计算确定性统计。",
        "inputSchema": {
            "type": "object",
            "required": ["from", "to", "fields"],
            "properties": {
                "from": {"type": "string"},
                "to": {"type": "string"},
                "fields": {
                    "type": "array",
                    "items": {"enum": sorted(ALLOWED_FIELDS)},
                },
            },
        },
    },
]


def result(request_id: Any, payload: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": payload}


def error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def handle(message: dict[str, Any], session: dict[str, bool]) -> dict[str, Any] | None:
    if message.get("jsonrpc") != "2.0":
        return error(message.get("id"), -32600, "jsonrpc must be 2.0")
    method = message.get("method")
    request_id = message.get("id")
    if method == "notifications/initialized":
        if not session["negotiated"]:
            return None
        session["initialized"] = True
        return None
    if method == "initialize":
        session["negotiated"] = True
        return result(
            request_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "metro-course-tools", "version": "1.0.0"},
                "instructions": "只读访问课程固定数据和知识卡。",
            },
        )
    if method in {"tools/list", "tools/call"} and not session["initialized"]:
        return error(request_id, -32002, "MCP session is not initialized")
    if method == "tools/list":
        return result(request_id, {"tools": TOOLS})
    if method == "tools/call":
        params = message.get("params")
        if not isinstance(params, dict):
            return error(request_id, -32602, "params must be an object")
        name = params.get("name")
        arguments = params.get("arguments")
        if not isinstance(arguments, dict):
            return error(request_id, -32602, "arguments must be an object")
        try:
            if name == "search_knowledge":
                payload = search_knowledge(arguments)
            elif name == "read_sensor_window":
                payload = read_sensor_window(arguments)
            else:
                return error(request_id, -32601, f"unknown tool: {name}")
        except ValueError as exc:
            return error(request_id, -32602, str(exc))
        return result(
            request_id,
            {
                "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
                "structuredContent": payload,
                "isError": False,
            },
        )
    return error(request_id, -32601, f"unknown method: {method}")


def main() -> int:
    session = {"negotiated": False, "initialized": False}
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            message = json.loads(line)
            response = handle(message, session)
        except (json.JSONDecodeError, TypeError) as exc:
            response = error(None, -32700, str(exc))
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
