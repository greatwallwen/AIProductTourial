from __future__ import annotations

import importlib.util
import tempfile
import json
from unittest.mock import patch
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "compose_course.py"
SPEC = importlib.util.spec_from_file_location("compose_course", MODULE_PATH)
assert SPEC and SPEC.loader
compose_course = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(compose_course)


class ComposeCourseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        (root / "first.md").write_text("# AI 时代产品工程\n\n示例正文\n", encoding="utf-8")
        (root / "second.md").write_text("# 第二部分\n\n练习\n", encoding="utf-8")
        manifest = root / "structure.json"
        manifest.write_text(json.dumps({"schema_version": "1.0", "chapters": [
            {"file": "first.md", "start_heading": "# AI 时代产品工程"},
            {"file": "second.md", "start_heading": "# 第二部分"}
        ]}), encoding="utf-8")
        patches = patch.multiple(compose_course, ROOT=root, MANIFEST_PATH=manifest)
        patches.start()
        self.addCleanup(patches.stop)

    def test_duplicate_chapters_are_rejected(self):
        manifest = compose_course.load_manifest()
        manifest["chapters"].append(manifest["chapters"][0])
        compose_course.MANIFEST_PATH.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate"):
            compose_course.load_manifest()

    def test_canonical_part_normalizes_newlines(self) -> None:
        self.assertEqual(compose_course.canonical_part("# A\r\n\r\nBody\r\n"), "# A\n\nBody\n")

    def test_chapter_manifest_has_unique_files_and_headings(self) -> None:
        manifest = compose_course.load_manifest()
        files = [item["file"] for item in manifest["chapters"]]
        headings = [item["start_heading"] for item in manifest["chapters"]]
        self.assertEqual(len(files), len(set(files)))
        self.assertEqual(len(headings), len(set(headings)))

    def test_composed_output_starts_and_ends_cleanly(self) -> None:
        manifest = compose_course.load_manifest()
        output = compose_course.compose(manifest)
        self.assertTrue(output.startswith("# AI 时代产品工程"))
        self.assertTrue(output.endswith("\n"))
        self.assertNotIn("\r", output)


if __name__ == "__main__":
    unittest.main()
