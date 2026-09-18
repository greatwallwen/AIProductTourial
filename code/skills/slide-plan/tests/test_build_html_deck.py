from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_html_deck.py"
SPEC = importlib.util.spec_from_file_location("build_html_deck", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


MARKDOWN = """# 让数据先过体检

> 从可读的 Markdown 到可编辑、可审计的演示文稿

## 01 为什么先体检

<!-- layout: section -->

## 缺失不是零

- 记录文件、编码、行列数与时间范围
- 分字段统计缺失，不自动删除或填补
- 把观察事实与处置建议分开

## 三项代表污染物缺失需单列

| 字段 | 缺失数 | 缺失率 |
|---|---:|---:|
| PM2.5 | 466 | 2.21% |
| CO | 1,027 | 4.88% |
| O3 | 830 | 3.95% |

## 把数据问题交给可复查的流程

<!-- graphic: quality-review-flow | 待读取→体检→人工复核→分析，保留停止分支。 -->
"""


class BuildHtmlDeckTests(unittest.TestCase):
    def test_parses_five_slides_and_preserves_table_values(self) -> None:
        deck = MODULE.parse_outline(MARKDOWN)

        self.assertEqual([slide["kind"] for slide in deck["slides"]], ["title", "section", "content", "table", "graphic"])
        self.assertEqual(deck["slides"][3]["rows"][1], ["PM2.5", "466", "2.21%"])
        self.assertIn("停止分支", deck["slides"][4]["graphic"])

    def test_render_is_offline_fixed_stage_and_keyboard_accessible(self) -> None:
        html = MODULE.render_html(MODULE.parse_outline(MARKDOWN))

        self.assertEqual(html.count('<section class="slide'), 5)
        self.assertIn("width: 1920px", html)
        self.assertIn("height: 1080px", html)
        self.assertIn("keydown", html)
        self.assertIn("touchstart", html)
        self.assertIn("wheel", html)
        self.assertIn("contentEditable", html)
        self.assertIn("localStorage", html)
        self.assertIn("prefers-reduced-motion", html)
        self.assertNotIn("https://", html)
        self.assertNotIn("http://", html)

    def test_cli_writes_html_and_receipt_without_mutating_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "outline.md"
            source.write_text(MARKDOWN, encoding="utf-8")
            before = source.read_bytes()
            html_output = root / "out" / "index.html"
            receipt_output = root / "out" / "receipt.json"

            completed = subprocess.run(
                [
                    sys.executable,
                    "-B",
                    str(SCRIPT),
                    "--input",
                    str(source),
                    "--allowed-root",
                    str(root),
                    "--html-output",
                    str(html_output),
                    "--receipt-output",
                    str(receipt_output),
                ],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(source.read_bytes(), before)
            receipt = json.loads(receipt_output.read_text(encoding="utf-8"))
            self.assertEqual(receipt["slide_count"], 5)
            self.assertTrue(receipt["offline"])
            self.assertEqual(receipt["source_skill"], "skills/frontend-slides/SKILL.md")
            self.assertTrue(html_output.is_file())


if __name__ == "__main__":
    unittest.main()
