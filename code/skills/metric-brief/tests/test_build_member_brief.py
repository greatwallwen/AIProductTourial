from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_member_brief.py"
SPEC = importlib.util.spec_from_file_location("build_member_brief", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def metric_by_id(result: dict, metric_id: str) -> dict:
    return next(item for item in result["metrics"] if item["metric_id"] == metric_id)


class BuildMemberBriefTests(unittest.TestCase):
    def _write_case(self, root: Path, include_buy_count: bool = True) -> Path:
        source = root / "case.csv"
        buy_header = ",buy_count" if include_buy_count else ""
        buy_values = [",2", ",4", ",6", ",8"] if include_buy_count else ["", "", "", ""]
        rows = [
            f"U1,观察{buy_values[0]},False,False",
            f"U2,成长{buy_values[1]},False,False",
            f"U3,成长{buy_values[2]},False,False",
            f"U4,核心{buy_values[3]},False,False",
        ]
        source.write_text(
            f"user_id,value_segment{buy_header},recency_available,monetary_available\n"
            + "\n".join(rows)
            + "\n",
            encoding="utf-8",
        )
        return source

    def test_calculates_observed_and_scenario_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._write_case(root)
            result = MODULE.build_metrics(
                source,
                root,
                coupon_amount_cny=Decimal("8"),
                target_segment="成长",
            )

            self.assertEqual(metric_by_id(result, "member_count")["value"], 4)
            segments = metric_by_id(result, "segment_distribution")["value"]
            self.assertEqual(segments["成长"], {"members": 2, "share": 0.5})
            self.assertEqual(metric_by_id(result, "average_buy_count")["value"]["overall"], 5.0)
            self.assertEqual(metric_by_id(result, "target_full_issue_budget")["value"], 16.0)
            self.assertEqual(metric_by_id(result, "historical_revenue")["status"], "not_calculable")
            brief = MODULE.render_brief(result)
            self.assertIn("## 事实", brief)
            self.assertIn("## 解释", brief)
            self.assertIn("## 下一步", brief)
            self.assertIn("不能证明优惠券会提升购买", brief)
            self.assertNotIn("calculation_id", brief)
            self.assertNotRegex(brief, r"[0-9a-f]{12}:member_count")

    def test_missing_buy_count_is_explicitly_not_calculable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._write_case(root, include_buy_count=False)
            result = MODULE.build_metrics(
                source,
                root,
                coupon_amount_cny=Decimal("8"),
                target_segment="成长",
            )
            metric = metric_by_id(result, "average_buy_count")
            self.assertEqual(metric["status"], "not_calculable")
            self.assertIn("buy_count", metric["limitation"])

    def test_cli_writes_outputs_without_mutating_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._write_case(root)
            before = source.read_bytes()
            metrics_output = root / "out" / "metrics.json"
            brief_output = root / "out" / "business-brief.md"
            completed = subprocess.run(
                [
                    sys.executable,
                    "-B",
                    str(SCRIPT),
                    "--input",
                    str(source),
                    "--allowed-root",
                    str(root),
                    "--coupon-amount-cny",
                    "8",
                    "--target-segment",
                    "成长",
                    "--metrics-output",
                    str(metrics_output),
                    "--brief-output",
                    str(brief_output),
                ],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(json.loads(completed.stdout)["status"], "complete")
            self.assertEqual(json.loads(metrics_output.read_text(encoding="utf-8"))["currency"], "CNY")
            self.assertEqual(source.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
