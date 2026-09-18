from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_prompt_comparison.py"


class BuildPromptComparisonTests(unittest.TestCase):
    def _load_module(self):
        spec = importlib.util.spec_from_file_location("build_prompt_comparison", SCRIPT)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def _brief(self, root: Path) -> Path:
        path = root / "brief.json"
        path.write_text(
            json.dumps(
                {
                    "theme": "雨天旧书店",
                    "audience": "下班后想慢下来的城市读者",
                    "headline": "雨落下来，书页慢下来",
                    "supporting_copy": ["躺进一页旧时光", "周五 19:30 · 夜读与换书"],
                    "required_copy": ["SECOND PAGE BOOKS", "入场免费"],
                    "visible_subjects": ["雨线", "暖黄橱窗", "旧书脊", "一盏灯"],
                    "forbidden": ["人物大特写", "高饱和多色渐变", "密集商业促销标签"],
                    "canvas": {"width": 1080, "height": 1440},
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return path

    def test_builds_four_traceable_prompt_groups_without_provider_claims(self) -> None:
        module = self._load_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._brief(root)
            result = module.build_comparison(source, root)

        self.assertEqual([group["id"] for group in result["groups"]], ["A", "B", "C", "D"])
        self.assertEqual(result["provider_execution"]["status"], "not-run")
        self.assertIsNone(result["provider_execution"]["provider"])
        self.assertEqual(result["output_evaluation"]["status"], "not-available")
        self.assertFalse(result["claims"]["images_generated"])

        groups = {group["id"]: group for group in result["groups"]}
        self.assertEqual(groups["A"]["method"], "ordinary-prompt")
        self.assertEqual(groups["C"]["template_id"], "poster-layout-system")
        self.assertIn("gpt-image-2-style-library", groups["C"]["skill_source"])
        self.assertEqual(groups["D"]["preset"], "editorial_text_card")
        self.assertIn("visual-memory-translator", groups["D"]["skill_source"])
        self.assertEqual(groups["D"]["task_fit"], "partial")

        for group_id in ("B", "C", "D"):
            prompt = groups[group_id]["prompt"]
            self.assertIn("雨落下来，书页慢下来", prompt)
            self.assertIn("SECOND PAGE BOOKS", prompt)
            self.assertIn("入场免费", prompt)
            self.assertIn("3:4", prompt)

    def test_cli_writes_json_markdown_and_prompt_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._brief(root)
            output = root / "out"
            completed = subprocess.run(
                [
                    sys.executable,
                    "-B",
                    str(SCRIPT),
                    "--input",
                    str(source),
                    "--allowed-root",
                    str(root),
                    "--output-dir",
                    str(output),
                ],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertTrue((output / "prompt-comparison.json").is_file())
            self.assertTrue((output / "prompt-comparison.md").is_file())
            self.assertEqual(
                {path.name for path in (output / "prompts").glob("*.txt")},
                {"A-ordinary.txt", "B-structured.txt", "C-style-library.txt", "D-memory-translator.txt"},
            )

    def test_rejects_input_outside_allowed_root(self) -> None:
        module = self._load_module()
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            allowed = base / "allowed"
            allowed.mkdir()
            source = self._brief(base)
            with self.assertRaisesRegex(ValueError, "input_outside_allowed_root"):
                module.build_comparison(source, allowed)


if __name__ == "__main__":
    unittest.main()
