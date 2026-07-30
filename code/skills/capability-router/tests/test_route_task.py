from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("route_task", SKILL_ROOT / "scripts" / "route_task.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CATALOG = json.loads((SKILL_ROOT / "contracts" / "capabilities.json").read_text(encoding="utf-8"))


def load_example(name: str) -> dict:
    return json.loads((SKILL_ROOT / "examples" / name).read_text(encoding="utf-8"))


class CapabilityRouterTests(unittest.TestCase):
    def test_selects_data_profile(self) -> None:
        result = MODULE.route_task(load_example("01-data-profile.json"), CATALOG)
        self.assertEqual(result["status"], "selected")
        self.assertEqual(result["selected_skill"], "data-profile")
        self.assertIsNone(result["stop_reason"])

    def test_selects_metric_brief(self) -> None:
        result = MODULE.route_task(load_example("02-metric-brief.json"), CATALOG)
        self.assertEqual(result["selected_skill"], "metric-brief")
        self.assertEqual(result["required_inputs"], [])

    def test_blocks_missing_input(self) -> None:
        result = MODULE.route_task(load_example("03-missing-input.json"), CATALOG)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["selected_skill"], "product-opportunity-map")
        self.assertEqual(result["required_inputs"], ["csv_path"])
        self.assertEqual(result["stop_reason"], "missing_required_inputs")

    def test_blocks_prohibited_action(self) -> None:
        result = MODULE.route_task(load_example("04-unauthorized-delete.json"), CATALOG)
        self.assertEqual(result["status"], "blocked")
        self.assertIsNone(result["selected_skill"])
        self.assertEqual(result["stop_reason"], "unauthorized_action:delete_source")

    def test_selects_product_opportunity_map(self) -> None:
        result = MODULE.route_task(load_example("05-opportunity-map.json"), CATALOG)
        self.assertEqual(result["status"], "selected")
        self.assertEqual(result["selected_skill"], "product-opportunity-map")

    def test_rejects_unknown_task(self) -> None:
        task = {
            "task_id": "unknown",
            "task": "帮我安排明天午饭",
            "inputs": {},
            "requested_actions": [],
            "permissions": [],
        }
        result = MODULE.route_task(task, CATALOG)
        self.assertEqual(result["stop_reason"], "no_matching_skill")


if __name__ == "__main__":
    unittest.main()
