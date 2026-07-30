from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
RUNNER = ROOT / "code" / "labs" / "loop-runtime" / "run_loop.py"


class LoopRuntimeTests(unittest.TestCase):
    def run_case(self, lab: str) -> tuple[Path, dict]:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        output = Path(temp.name)
        completed = subprocess.run(
            [sys.executable, "-B", str(RUNNER), "--lab", lab, "--output", str(output)],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        summary = json.loads(completed.stdout)
        receipt = json.loads((output / f"loop-run-{lab}.json").read_text(encoding="utf-8"))
        self.assertEqual(summary["lab"], lab)
        self.assertTrue(all(check["passed"] for check in receipt["checks"]))
        return output, receipt

    def test_l01_runs_two_real_skills_and_stops(self) -> None:
        output, receipt = self.run_case("L01")
        self.assertEqual(receipt["state"], "completed")
        self.assertEqual(receipt["stop_reason"], "acceptance_passed")
        self.assertEqual(receipt["facts"]["members"], 5000)
        self.assertEqual(receipt["facts"]["coupon_face_value_ceiling_cny"], 10000.0)
        self.assertEqual(len(receipt["calls"]), 2)
        self.assertTrue((output / "L01" / "business-brief.md").exists())

    def test_l02_creates_three_directions_then_waits_for_visual_choice(self) -> None:
        output, receipt = self.run_case("L02")
        self.assertEqual(receipt["state"], "waiting_human")
        self.assertEqual(receipt["stop_reason"], "visual_choice_required")
        self.assertEqual(receipt["facts"]["candidate_count"], 3)
        self.assertFalse(receipt["facts"]["provider_called"])
        self.assertTrue((output / "L02" / "poster.svg").exists())

    def test_l03_uses_public_window_without_claiming_diagnosis(self) -> None:
        output, receipt = self.run_case("L03")
        self.assertEqual(receipt["state"], "waiting_human")
        self.assertEqual(receipt["stop_reason"], "permission_required")
        self.assertEqual(receipt["facts"]["rows"], 25)
        packet = json.loads((output / "L03" / "approval-packet.json").read_text(encoding="utf-8"))
        self.assertEqual(packet["status"], "waiting_human")
        self.assertNotIn("diagnosis", packet)


if __name__ == "__main__":
    unittest.main()
