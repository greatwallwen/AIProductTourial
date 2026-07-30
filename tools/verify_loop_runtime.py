from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "evidence" / "runtime" / "loop-runtime"
CONTRACT = ROOT / "code" / "labs" / "loop-runtime" / "contracts.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    contract = load(CONTRACT)
    expected = {
        "L01": ("completed", "acceptance_passed"),
        "L02": ("waiting_human", "visual_choice_required"),
        "L03": ("waiting_human", "permission_required"),
    }
    declared = {item["id"]: (item["terminal"], item["stopReason"]) for item in contract["cases"]}
    if declared != expected:
        raise SystemExit(f"Loop contract mismatch: {declared!r}")

    artifact_count = 0
    for lab_id, (state, stop_reason) in expected.items():
        receipt_path = RUNTIME / f"loop-run-{lab_id}.json"
        receipt = load(receipt_path)
        if receipt["lab_id"] != lab_id or receipt["state"] != state or receipt["stop_reason"] != stop_reason:
            raise SystemExit(f"{lab_id}: state or stop reason mismatch")
        if not receipt["checks"] or not all(item.get("passed") is True for item in receipt["checks"]):
            raise SystemExit(f"{lab_id}: failed acceptance check")
        for item in receipt["output_artifacts"]:
            path = (ROOT / item).resolve()
            if not path.is_relative_to(ROOT.resolve()) or not path.is_file():
                raise SystemExit(f"{lab_id}: missing or unsafe output {item}")
            artifact_count += 1

    l02 = load(RUNTIME / "loop-run-L02.json")
    if l02["facts"] != {"candidate_count": 3, "recommended": "quiet-window", "provider_called": False}:
        raise SystemExit("L02: visual-choice facts changed")
    l03_packet = load(RUNTIME / "L03" / "approval-packet.json")
    serialized = json.dumps(l03_packet, ensure_ascii=False)
    if l03_packet["status"] != "waiting_human" or any(term in serialized for term in ["故障根因是", "自动维修已执行", "自动停机已执行"]):
        raise SystemExit("L03: approval packet crossed the allowed action boundary")

    print(f"loop_cases=3, checks=12, output_artifacts={artifact_count}, states=1-completed+2-waiting-human")


if __name__ == "__main__":
    main()
