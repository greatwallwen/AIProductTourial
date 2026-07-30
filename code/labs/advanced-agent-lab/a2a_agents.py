from __future__ import annotations

from typing import Any


AGENT_CARDS = {
    "sensor-review-agent": {
        "name": "传感窗口复核 Agent",
        "description": "复核固定时间窗统计，只描述数据，不诊断故障。",
        "version": "1.0.0",
        "skills": [{"id": "sensor-window-review", "name": "传感窗口复核"}],
        "supportedInterfaces": [{"protocolBinding": "local-course-a2a", "protocolVersion": "1.0.0"}],
    },
    "operations-review-agent": {
        "name": "运营响应 Agent",
        "description": "从运营连续性角度提出动作建议，供汇总器检查。",
        "version": "1.0.0",
        "skills": [{"id": "operations-response", "name": "运营响应建议"}],
        "supportedInterfaces": [{"protocolBinding": "local-course-a2a", "protocolVersion": "1.0.0"}],
    },
    "policy-review-agent": {
        "name": "权限规则 Agent",
        "description": "核对课程检查程序、人工批准与禁止动作。",
        "version": "1.0.0",
        "skills": [{"id": "policy-review", "name": "权限规则复核"}],
        "supportedInterfaces": [{"protocolBinding": "local-course-a2a", "protocolVersion": "1.0.0"}],
    },
}


def message(message_id: str, text: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "messageId": message_id,
        "role": "user",
        "parts": [
            {"kind": "text", "text": text},
            {"kind": "data", "data": data},
        ],
    }


def _opinion(agent_id: str, context: dict[str, Any]) -> dict[str, Any]:
    window = context["window"]
    if agent_id == "sensor-review-agent":
        return {
            "agent_id": agent_id,
            "finding": f"窗口共 {window['rows']} 条记录，可以复核压力、油温和电流统计。",
            "recommended_action": "create_inspection_request",
            "diagnosis": None,
            "citations": ["UCI-791-SOURCE", "UCI-791-FIELDS"],
            "confidence": "data-supported",
        }
    if agent_id == "operations-review-agent":
        return {
            "agent_id": agent_id,
            "finding": "窗口被课程数据标记为已知故障区间，运营侧希望立即降低风险。",
            "recommended_action": "stop_equipment",
            "diagnosis": "suspected-compressor-failure",
            "citations": ["UCI-791-SOURCE"],
            "confidence": "insufficient-policy-support",
        }
    if agent_id == "policy-review-agent":
        return {
            "agent_id": agent_id,
            "finding": "课程规则要求先核对窗口与传感器状态，并把检查工单交给有权限的人员批准。",
            "recommended_action": "wait_for_human_approval",
            "diagnosis": None,
            "citations": ["COURSE-09-INSPECTION", "COURSE-09-APPROVAL"],
            "confidence": "policy-supported",
        }
    raise ValueError(f"unknown agent: {agent_id}")


def handle_task(agent_id: str, task_id: str, context_id: str, request: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if agent_id not in AGENT_CARDS:
        raise ValueError(f"unknown agent: {agent_id}")
    opinion = _opinion(agent_id, context)
    completed_at = context["window"]["to"].replace(" ", "T") + "Z"
    return {
        "id": task_id,
        "contextId": context_id,
        "status": {"state": "completed", "timestamp": completed_at},
        "history": [request],
        "artifacts": [
            {
                "artifactId": f"{task_id}-opinion",
                "name": f"{AGENT_CARDS[agent_id]['name']}意见",
                "parts": [{"kind": "data", "data": opinion}],
            }
        ],
        "metadata": {"agentCard": AGENT_CARDS[agent_id]},
    }


def aggregate(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    opinions = [task["artifacts"][0]["parts"][0]["data"] for task in tasks]
    proposed = {opinion["recommended_action"] for opinion in opinions}
    conflicts = []
    if "stop_equipment" in proposed and "wait_for_human_approval" in proposed:
        conflicts.append(
            {
                "topic": "是否自动停机",
                "proposals": ["stop_equipment", "wait_for_human_approval"],
                "resolution": "reject_automatic_control",
                "reason": "课程策略明确禁止自动停机，且公开传感数据不提供诊断或设备控制权限。",
                "citations": ["COURSE-09-APPROVAL", "UCI-791-SOURCE"],
            }
        )
    return {
        "opinions": opinions,
        "conflicts": conflicts,
        "selected_action": "prepare_inspection_request",
        "state": "waiting_human",
        "human_gate": "由有权限的主管决定是否创建现场检查工单。",
        "rejected_actions": ["stop_equipment", "repair_equipment", "diagnose_failure"],
    }
