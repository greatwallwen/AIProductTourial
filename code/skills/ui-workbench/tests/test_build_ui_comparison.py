from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_ui_comparison.py"


class BuildUiComparisonTests(unittest.TestCase):
    def test_builds_context_from_real_b10_csv(self) -> None:
        spec = importlib.util.spec_from_file_location("build_ui_comparison", SCRIPT)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader if spec else None)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        source = Path("dataset/10-telecom-complaint-orchestration/case.csv")
        context = module.load_context(source)

        self.assertEqual(context["row_count"], 1000)
        self.assertEqual(context["scenario_counts"], {
            "committed_response_lost": 333,
            "effect_status_unknown": 333,
            "not_committed": 334,
        })
        self.assertEqual(context["selected"]["task_id"], "CN-TEL-2025Q2-0008")
        self.assertEqual(context["selected"]["city"], "福州")

    def test_rendered_variants_keep_accessibility_and_real_tabler_reference(self) -> None:
        spec = importlib.util.spec_from_file_location("build_ui_comparison", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        context = module.load_context(Path("dataset/10-telecom-complaint-orchestration/case.csv"))

        skill_html = module.render_page(context, "skill")
        tabler_html = module.render_page(context, "tabler")

        for html in (skill_html, tabler_html):
            self.assertIn('href="#workspace"', html)
            self.assertIn('aria-label="匿名恢复核查单目录"', html)
            self.assertIn('aria-label="调用链路取证"', html)
            self.assertIn('aria-label="核对结果与完成条件"', html)
            self.assertIn("CN-TEL-2025Q2-0008", html)
            self.assertIn("外部效果未知", html)
            self.assertIn("仍未知", html)
            self.assertIn("已生效", html)
            self.assertIn("未生效", html)
            self.assertIn("@media (max-width: 760px)", html)
            self.assertIn("validateResult", html)
            self.assertNotIn("手机号", html)
            self.assertNotIn("身份证", html)

        self.assertNotIn("tabler.min.css", skill_html)
        self.assertIn('href="vendor/tabler.min.css"', tabler_html)
        self.assertIn('class="chain-block card"', tabler_html)
        self.assertIn(' btn btn-primary', tabler_html)
        self.assertIn(' badge bg-azure-lt', tabler_html)

    def test_cli_writes_both_pages_prompts_and_receipt_without_mutating_source(self) -> None:
        source = Path("dataset/10-telecom-complaint-orchestration/case.csv").resolve()
        css = Path("vendor/tabler/1.4.0/tabler.min.css").resolve()
        before = source.read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "out"
            completed = subprocess.run(
                [
                    sys.executable,
                    "-B",
                    str(SCRIPT),
                    "--input",
                    str(source),
                    "--allowed-root",
                    str(source.parent),
                    "--tabler-css",
                    str(css),
                    "--output-dir",
                    str(output),
                ],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(source.read_bytes(), before)
            self.assertTrue((output / "skill-only" / "index.html").is_file())
            self.assertTrue((output / "tabler" / "index.html").is_file())
            self.assertEqual(
                (output / "tabler" / "vendor" / "tabler.min.css").read_bytes(),
                css.read_bytes(),
            )
            prompts = sorted((output / "prompts").glob("*.txt"))
            self.assertEqual(len(prompts), 4)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["source_skill"], "code/skills/ui-workbench/SKILL.md")
            self.assertEqual(receipt["ui_kit"], "@tabler/core@1.4.0")


if __name__ == "__main__":
    unittest.main()
