import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = ROOT / "md/04-案例与实践篇"
CASES = {
    "09-通用Skill案例-办公与表达.md": ("skill-s05", "skill-s06", "skill-network-model-quiz"),
    "10-通用Skill案例-开发与设计.md": ("skill-s10", "skill-s11"),
    "11-综合业务案例.md": tuple(f"case-b{index:02d}" for index in range(1, 21)),
}


class CaseChapterLayoutTests(unittest.TestCase):
    def test_development_cases_are_complete_once_with_original_prompts(self):
        chapter = (CHAPTERS / "10-通用Skill案例-开发与设计.md").read_text(encoding="utf-8")
        self.assertIn('## 先把“能用”说具体', chapter)
        self.assertNotIn("## 完整案例：", chapter)
        self.assertEqual(len(re.findall(r"^## S(?:10|11)：", chapter, re.M)), 2)
        for case, names in {
            "S10": ("A-ordinary", "B-structured", "C-ui-workbench-skill", "D-ui-workbench-tabler"),
            "S11": ("A-css-fake", "B-ordinary-three", "C-three-scope-map-skill"),
        }.items():
            for name in names:
                prompt = (ROOT / f"assets/{case}/prompts/{name}.txt").read_text(encoding="utf-8").strip()
                with self.subTest(case=case, prompt=name):
                    self.assertIn(f"```text\n{prompt}\n```", chapter)

    def test_office_cases_are_complete_once_with_original_prompts(self):
        chapter = (CHAPTERS / "09-通用Skill案例-办公与表达.md").read_text(encoding="utf-8")
        self.assertIn("## 先看要交付什么", chapter)
        self.assertIn("学校课程课件", chapter)
        self.assertNotIn("extra/", chapter)
        self.assertNotIn("## 完整案例：", chapter)
        self.assertEqual(len(re.findall(r"^## (?:S05|S06|第三讲网络模型)：", chapter, re.M)), 3)
        self.assertIn("教学复现用 Prompt", chapter)

        comparison = (ROOT / "assets/S05/comparison/prompt-comparison.md").read_text(encoding="utf-8")
        for prompt in re.findall(r"```text\n(.*?)\n```", comparison, flags=re.S):
            with self.subTest(prompt=prompt[:30]):
                self.assertIn(f"```text\n{prompt}\n```", chapter)
        for name in ("A-ordinary", "B-structured"):
            prompt = (ROOT / f"assets/S06/comparison/prompts/{name}.txt").read_text(encoding="utf-8").strip()
            with self.subTest(prompt=name):
                self.assertIn(f"```text\n{prompt}\n```", chapter)

    def test_all_case_explanations_live_in_chapters(self):
        for filename, case_ids in CASES.items():
            text = (CHAPTERS / filename).read_text(encoding="utf-8")
            for case_id in case_ids:
                with self.subTest(chapter=filename, case=case_id):
                    self.assertEqual(text.count(f'<a id="{case_id}"></a>'), 1)
        self.assertFalse((ROOT / "md/cases").exists())
        self.assertEqual(list((ROOT / "code/cases").rglob("*.md")), [])

    def test_case_chapter_links(self):
        documents = [CHAPTERS / filename for filename in CASES]
        documents.extend((
            ROOT / "md/案例索引.md",
            ROOT / "md/README.md",
            ROOT / "md/01-基础篇/01-逻辑证据与AI基础.md",
            ROOT / "md/02-能力篇/05-Skill工程-结构发布与治理.md",
            ROOT / "md/03-产品篇/08-产品与系统架构.md",
            ROOT / "md/04-案例与实践篇/12-课程项目.md",
        ))
        for document in documents:
            for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", document.read_text(encoding="utf-8")):
                path, _, anchor = target.partition("#")
                if "://" in path or path.startswith("mailto:"):
                    continue
                destination = (document.parent / path).resolve() if path else document
                with self.subTest(document=document.name, target=target):
                    self.assertTrue(destination.exists())
                    if anchor and destination.suffix == ".md" and (
                        anchor.startswith(("case-b", "skill-s"))
                        or anchor == "skill-network-model-quiz"
                    ):
                        self.assertIn(
                            f'<a id="{anchor}"></a>', destination.read_text(encoding="utf-8")
                        )


if __name__ == "__main__":
    unittest.main()
