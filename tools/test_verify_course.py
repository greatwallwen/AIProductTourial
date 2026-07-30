from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from verify_course import case_topology_errors, verify_markdown_case, verify_screenshot_links


class CourseVerificationTest(unittest.TestCase):
    def test_accepts_current_screenshot_sequence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            screenshots = root / "evidence" / "screenshots"
            screenshots.mkdir(parents=True)
            for case_id in ("01", "02"):
                (screenshots / f"{case_id}-work-productized.png").write_bytes(
                    b"\x89PNG\r\n\x1a\n"
                )
            text = "\n".join(
                f"![界面](../evidence/screenshots/{case_id}-work-productized.png)"
                for case_id in ("01", "02")
            )
            errors: list[str] = []
            verify_screenshot_links(text, errors, root=root, expected_count=2)
            self.assertEqual([], errors)

    def test_rejects_visible_sha(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            screenshot = root / "evidence" / "screenshots" / "01-work-productized.png"
            screenshot.parent.mkdir(parents=True)
            screenshot.write_bytes(b"png")
            errors: list[str] = []
            verify_screenshot_links(
                "![界面](../evidence/screenshots/01-work-productized.png)\nSHA-256",
                errors,
                root=root,
                expected_count=1,
            )
            self.assertTrue(any("must not expose SHA" in error for error in errors))

    def test_rejects_topology_gap(self) -> None:
        manifest = [{"id": "01"}, {"id": "02"}]
        catalog = [{"id": "01"}, {"id": "03"}]
        datasets = {"datasets": [{"case_id": "01"}, {"case_id": "02"}]}
        errors = case_topology_errors(manifest, catalog, datasets)
        self.assertTrue(any("contiguous" in error for error in errors))

    def test_accepts_plain_language_case_structure_without_mermaid(self) -> None:
        text = "\n".join(
            [
                "# 案例 01 示例",
                "## 问题",
                "## 数据",
                "## 解决方案",
                "## CodeBuddy Prompt",
                "## 演示",
            ]
        )
        errors: list[str] = []
        verify_markdown_case("01", text, errors)
        self.assertEqual([], errors)

    def test_rejects_mermaid_case_diagram(self) -> None:
        text = "\n".join(
            [
                "## 问题",
                "## 数据",
                "## 解决方案",
                "```mermaid",
                "flowchart LR",
                "```",
                "## CodeBuddy Prompt",
                "## 演示",
            ]
        )
        errors: list[str] = []
        verify_markdown_case("01", text, errors)
        self.assertTrue(any("must not use Mermaid" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
