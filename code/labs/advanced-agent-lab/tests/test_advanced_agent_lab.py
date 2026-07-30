from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
LAB = ROOT / "code" / "labs" / "advanced-agent-lab"
RUNNER = LAB / "run_lab.py"
sys.path.insert(0, str(LAB))

import mcp_server  # noqa: E402
from run_lab import evaluate_summary  # noqa: E402


class AdvancedAgentLabTests(unittest.TestCase):
    def run_offline(self) -> tuple[Path, dict]:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        output = Path(temp.name)
        completed = subprocess.run(
            [
                sys.executable,
                "-B",
                str(RUNNER),
                "--output-dir",
                str(output),
                "--provider",
                "offline",
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        summary = json.loads(completed.stdout)
        self.assertEqual(summary["final_state"], "waiting_human")
        return output, json.loads((output / "receipt.json").read_text(encoding="utf-8"))

    def test_offline_replay_compares_rag_and_stops_for_human(self) -> None:
        output, receipt = self.run_offline()
        ordinary = json.loads((output / "ordinary-rag.json").read_text(encoding="utf-8"))
        agentic = json.loads((output / "agentic-rag.json").read_text(encoding="utf-8"))
        review = json.loads((output / "multi-agent-review.json").read_text(encoding="utf-8"))
        self.assertEqual(ordinary["state"], "incomplete")
        self.assertEqual(agentic["queries"], 2)
        self.assertTrue(agentic["coverage_check"]["complete_after_second_query"])
        self.assertEqual(review["state"], "waiting_human")
        self.assertIn("stop_equipment", review["rejected_actions"])
        self.assertTrue(all(check["passed"] for check in receipt["checks"]))

    def test_mcp_and_a2a_traces_are_real_structured_artifacts(self) -> None:
        output, _ = self.run_offline()
        transcript = json.loads((output / "mcp-transcript.json").read_text(encoding="utf-8"))
        methods = [
            item["message"].get("method")
            for item in transcript["messages"]
            if item["direction"] == "client_to_server"
        ]
        self.assertEqual(transcript["protocol_version"], "2025-11-25")
        self.assertIn("initialize", methods)
        self.assertIn("tools/list", methods)
        self.assertEqual(methods.count("tools/call"), 3)
        a2a = json.loads((output / "a2a-tasks.json").read_text(encoding="utf-8"))
        self.assertEqual(len(a2a["tasks"]), 3)
        self.assertTrue(all(task["status"]["state"] == "completed" for task in a2a["tasks"]))
        self.assertTrue(all(task["artifacts"] for task in a2a["tasks"]))

    def test_receipt_hashes_match_and_provider_fields_are_redacted(self) -> None:
        output, receipt = self.run_offline()
        provider = json.loads((output / "provider-receipt.json").read_text(encoding="utf-8"))
        self.assertEqual(provider["status"], "not-run")
        self.assertEqual(provider["redacted_fields"], ["authorization", "provider_response_id"])
        for artifact in receipt["artifacts"]:
            actual = hashlib.sha256((output / artifact["path"]).read_bytes()).hexdigest()
            self.assertEqual(actual, artifact["sha256"])

    def test_mcp_server_rejects_unapproved_scopes_and_fields(self) -> None:
        with self.assertRaises(ValueError):
            mcp_server.search_knowledge({"query": "test", "sourceIds": ["../../private"], "topK": 1})
        with self.assertRaises(ValueError):
            mcp_server.read_sensor_window(
                {
                    "from": "2020-04-17 23:57:30",
                    "to": "2020-04-18 00:02:30",
                    "fields": ["password"],
                }
            )

    def test_summary_check_distinguishes_reported_conflict_from_direct_control(self) -> None:
        reported = "窗口事实：25条中13条标记。\n意见冲突：运营侧建议立即停机。\n下一步：等待人工决定。"
        direct = "窗口事实：25条中13条标记。\n下一步：立即停机，再等待人工决定。"
        self.assertEqual(evaluate_summary(reported)["status"], "passed")
        self.assertEqual(evaluate_summary(direct)["status"], "failed")


if __name__ == "__main__":
    unittest.main()
