from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_poster.py"
SPEC = importlib.util.spec_from_file_location("build_poster", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class BuildPosterTests(unittest.TestCase):
    def _brief(self, root: Path) -> Path:
        path = root / "brief.json"
        path.write_text(
            json.dumps(
                {
                    "theme": "雨天旧书店",
                    "audience": "下班读者",
                    "headline": "雨落下来，书页慢下来",
                    "supporting_copy": ["躺进一页旧时光"],
                    "required_copy": ["入场免费"],
                    "visible_subjects": ["雨线", "橱窗"],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return path

    def test_builds_three_distinct_recipes_and_editable_svg(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._brief(root)
            path, brief, digest = MODULE.load_brief(source, root)
            result = MODULE.build_recipes(brief, path, digest)
            svg = MODULE.render_svg(result, brief)

            self.assertEqual(len(result["recipes"]), 3)
            self.assertEqual(len({item["layout"]["system"] for item in result["recipes"]}), 3)
            self.assertEqual(len({tuple(item["palette"]) for item in result["recipes"]}), 3)
            self.assertEqual(result["selected_recipe_id"], "quiet-window")
            self.assertFalse(result["image_provider_called"])
            self.assertIsNone(result["image_provider_receipt"])
            self.assertIn('data-editable="true"', svg)
            self.assertIn("<text", svg)
            self.assertEqual(svg.count("<tspan"), 2)
            self.assertNotIn("<image", svg)

    def test_cli_writes_outputs_without_mutating_brief(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self._brief(root)
            before = source.read_bytes()
            recipe_output = root / "out" / "recipes.json"
            svg_output = root / "out" / "poster.svg"
            completed = subprocess.run(
                [
                    sys.executable,
                    "-B",
                    str(SCRIPT),
                    "--input",
                    str(source),
                    "--allowed-root",
                    str(root),
                    "--recipe-output",
                    str(recipe_output),
                    "--svg-output",
                    str(svg_output),
                ],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(json.loads(completed.stdout)["recipes"], 3)
            self.assertEqual(source.read_bytes(), before)
            self.assertIn("editable-svg", recipe_output.read_text(encoding="utf-8"))
            self.assertIn("bookstore-window", svg_output.read_text(encoding="utf-8"))

    def test_blocks_input_outside_allowed_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            allowed = base / "allowed"
            allowed.mkdir()
            source = self._brief(base)
            with self.assertRaisesRegex(ValueError, "input_outside_allowed_root"):
                MODULE.load_brief(source, allowed)


if __name__ == "__main__":
    unittest.main()
