from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "compose_course.py"
SPEC = importlib.util.spec_from_file_location("compose_course", MODULE_PATH)
assert SPEC and SPEC.loader
compose_course = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(compose_course)


class ComposeCourseTests(unittest.TestCase):
    def test_canonical_part_normalizes_newlines(self) -> None:
        self.assertEqual(compose_course.canonical_part("# A\r\n\r\nBody\r\n"), "# A\n\nBody\n")

    def test_chapter_manifest_has_unique_files_and_headings(self) -> None:
        manifest = compose_course.load_manifest()
        chapters = [item for item in manifest["sections"] if item["kind"] == "chapter"]
        files = [item["file"] for item in chapters]
        headings = [item["start_heading"] for item in chapters]
        self.assertEqual(len(files), len(set(files)))
        self.assertEqual(len(headings), len(set(headings)))

    def test_composed_output_starts_and_ends_cleanly(self) -> None:
        # The bootstrap phase creates the real chapter files before this test runs.
        manifest = compose_course.load_manifest()
        output = compose_course.compose(manifest)
        self.assertTrue(output.startswith("# AI 时代产品工程"))
        self.assertTrue(output.endswith("\n"))
        self.assertNotIn("\r", output)

    def test_cases_are_grouped_and_demoted_in_the_handbook(self) -> None:
        manifest = compose_course.load_manifest()
        output = compose_course.compose(manifest)
        self.assertEqual(4, len(manifest["case_groups"]))
        self.assertEqual(24, output.count("### 综合案例 B"))
        self.assertNotIn("\n# 综合案例 B", output)
        self.assertIn("## 经营与公共服务：材料不全时怎样继续工作", output)
        self.assertIn("#### 八万多元取消单，先别猜原单", output)


if __name__ == "__main__":
    unittest.main()
