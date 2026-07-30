from __future__ import annotations

import importlib.util
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
COURSE_ROOT = SKILL_ROOT.parents[2]
DATA_ROOT = COURSE_ROOT / "dataset"
INPUT = DATA_ROOT / "S-agent-skill-cases" / "case.csv"
SPEC = importlib.util.spec_from_file_location(
    "build_opportunity_map", SKILL_ROOT / "scripts" / "build_opportunity_map.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ProductOpportunityMapTests(unittest.TestCase):
    def setUp(self) -> None:
        self.document = MODULE.build_map(INPUT, DATA_ROOT)

    def test_uses_only_s04_source_rows(self) -> None:
        self.assertEqual(self.document["source"]["row_count"], 4)
        self.assertEqual({row["lab_id"] for row in self.document["source_records"]}, {"S04"})
        self.assertEqual(len(self.document["source_records"]), 4)

    def test_opportunity_labels_are_supported_by_action_detail(self) -> None:
        action_detail = next(row["detail"] for row in self.document["source_records"] if row["step_id"] == "03")
        opportunities = [node for node in self.document["nodes"] if node["kind"] == "opportunity"]
        self.assertEqual([node["label"] for node in opportunities], ["缩短订单定位", "缩短审批等待"])
        for node in opportunities:
            self.assertIn(node["label"].removeprefix("缩短"), action_detail)
            self.assertEqual(node["source_refs"][0]["field"], "detail")
            self.assertEqual(node["source_refs"][0]["value"], action_detail)

    def test_every_node_preserves_source_field(self) -> None:
        for node in self.document["nodes"]:
            self.assertTrue(node["source_refs"])
            for ref in node["source_refs"]:
                self.assertIn(ref["field"], self.document["source"]["fields"])
                self.assertTrue(ref["value"])

    def test_svg_is_editable_xml_not_mermaid(self) -> None:
        svg = MODULE.render_svg(self.document)
        parsed = ET.fromstring(svg)
        self.assertTrue(parsed.tag.endswith("svg"))
        self.assertNotIn("mermaid", svg.lower())
        self.assertIn('id="node-opportunity-order-link"', svg)
        self.assertIn('data-source-row="', svg)
        self.assertIn("缩短订单定位", svg)
        self.assertIn("dataset/S-agent-skill-cases/case.csv", svg)
        self.assertNotIn("SHA-256", svg)
        self.assertNotIn(str(INPUT.resolve()), svg)

    def test_rejects_input_outside_allowed_root(self) -> None:
        with self.assertRaisesRegex(ValueError, "input_outside_allowed_root"):
            MODULE.build_map(SKILL_ROOT / "SKILL.md", DATA_ROOT)


if __name__ == "__main__":
    unittest.main()
