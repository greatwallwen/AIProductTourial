import json
import re
import unittest
from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = ROOT / "md/04-案例与实践篇"
CASES = {
    "09-通用Skill案例-办公与表达.md": ("skill-s05", "skill-s06", "skill-network-model-quiz"),
    "10-通用Skill案例-开发与设计.md": ("skill-tide-musicbox", "skill-bedroom-layout", "skill-s10", "skill-s11"),
    "11-综合业务案例.md": tuple(f"case-b{index:02d}" for index in range(1, 21)),
}


class CaseChapterLayoutTests(unittest.TestCase):
    def test_tide_case_lives_in_chapter_not_the_music_box(self):
        chapter = (CHAPTERS / "10-通用Skill案例-开发与设计.md").read_text(encoding="utf-8")
        evidence = ROOT / "assets/skill-tide-musicbox"
        self.assertLess(chapter.index('<a id="skill-tide-musicbox"></a>'), chapter.index('<a id="skill-bedroom-layout"></a>'))
        tide_case = chapter.split('<a id="skill-tide-musicbox"></a>', 1)[1].split('<a id="skill-bedroom-layout"></a>', 1)[0]
        prompt = (evidence / "14day-logic/PROMPT.md").read_text(encoding="utf-8").split("\n\n", 1)[1].strip()
        self.assertIn(f"```text\n{prompt}\n```", tide_case)
        self.assertNotIn("两日", tide_case)
        self.assertNotIn("2026-11-02", tide_case)
        self.assertNotIn("与 S10", tide_case)
        self.assertNotIn("卧室案例", tide_case)
        self.assertIn("人工试听", tide_case)
        self.assertIn("你已实际试听", tide_case)
        self.assertIn("人工固定", tide_case)
        self.assertIn("不是由算法选出的最佳片段", tide_case)
        self.assertIn("自动化不能替人判断好听", tide_case)
        self.assertIn("补测", tide_case)
        for filename in (
            "source-14day-browser-print.pdf", "extraction-14day-result.json",
            "14day-logic/prototype14-logic.html", "tide14-studio.html",
            "十四日-演示原始映射.wav", "十四日-演示新规则未改编.wav",
            "十四日-演示人工改编.wav", "tide14-browser-check.json", "14day-logic/browser-check.json",
        ):
            self.assertTrue((evidence / filename).is_file(), filename)
            self.assertIn(filename, chapter)
        trial = json.loads((evidence / "14day-logic/browser-check.json").read_text(encoding="utf-8"))
        self.assertEqual(trial["errors"], [])
        self.assertEqual(trial["checks"]["mobile"], {"width": 390, "scrollWidth": 390})
        self.assertEqual(
            sha256((evidence / "source-14day-browser-print.pdf").read_bytes()).hexdigest(),
            "7263feafed630b808a2e52d3e404ea680549653f96693cbaba95cac46a8813f3",
        )
        self.assertEqual(
            sha256((evidence / "skills-321658273cb1d20b76026717d027d505790106d4.zip").read_bytes()).hexdigest(),
            "a1f244fa3ac2caa9b8316f333fd56ff25f31d6f1b52bd415775727d8464ec109",
        )
        report = json.loads((evidence / "tide14-browser-check.json").read_text(encoding="utf-8"))
        self.assertEqual(report["errors"], [])
        self.assertIn("appOnly", report["checks"])
        self.assertTrue(report["checks"]["mobile"]["noHorizontalOverflow"])
        for filename in ("十四日-演示原始映射.wav", "十四日-演示新规则未改编.wav", "十四日-演示人工改编.wav"):
            self.assertEqual((evidence / filename).read_bytes()[:4], b"RIFF")
        page = (evidence / "tide14-studio.html").read_text(encoding="utf-8")
        self.assertNotIn('id="caseProof"', page)
        self.assertNotIn('class="caseAudio"', page)
        self.assertIn('id="player"', page)
        self.assertNotIn("两日", (evidence / "README.md").read_text(encoding="utf-8"))
        for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", (evidence / "README.md").read_text(encoding="utf-8")):
            path = target.split("#", 1)[0]
            self.assertTrue((evidence / path).resolve().exists(), target)

    def test_bedroom_case_exhibits_only_the_final_skill_artifact(self):
        chapter = (CHAPTERS / "10-通用Skill案例-开发与设计.md").read_text(encoding="utf-8")
        bedroom_case = chapter.split('<a id="skill-bedroom-layout"></a>', 1)[1].split('<a id="skill-s10"></a>', 1)[0]
        self.assertIn("../../assets/skill-bedroom-layout/skill-run/skill-comparison.png", bedroom_case)
        self.assertIn("验收脚本操作最终页面导出", bedroom_case)
        self.assertNotIn("user-exported-comparison.png", bedroom_case)
        self.assertNotIn("skill-bedroom-layout/room-start.png", bedroom_case)
        self.assertNotIn("room-studio.html", bedroom_case)
        self.assertNotIn("第二版", bedroom_case)
        self.assertNotIn("旧版", bedroom_case)
        self.assertIn("候选书桌 B", chapter)
        self.assertIn("候选书桌 C", chapter)

    def test_bedroom_skill_run_includes_original_prompt_and_artifact(self):
        chapter = (CHAPTERS / "10-通用Skill案例-开发与设计.md").read_text(encoding="utf-8")
        evidence = ROOT / "assets/skill-bedroom-layout/skill-run"
        prompt = (evidence / "PROMPT.md").read_text(encoding="utf-8").split("\n\n", 1)[1].strip()
        final_artifact_excerpt = prompt.rsplit("\n\n", 1)[0]
        self.assertIn(f"```text\n{final_artifact_excerpt}\n```", chapter)
        self.assertNotIn(prompt.rsplit("\n\n", 1)[1], chapter)
        self.assertNotIn("baseline-desktop.png", (evidence / "README.md").read_text(encoding="utf-8"))
        self.assertIn("../../code/cases/bedroom-layout-studio/skill-web-artifacts-builder/bundle.html", chapter)
        artifact = ROOT / "code/cases/bedroom-layout-studio/skill-web-artifacts-builder/bundle.html"
        self.assertEqual(
            sha256(artifact.read_bytes()).hexdigest(),
            "87b532afe46d719c8f69946237b5db351b6513fdee0f88b84ec6e7e84585448a",
        )
        result = json.loads((evidence / "browser-final-check.json").read_text(encoding="utf-8"))
        self.assertTrue(result["dragMove"] and result["restoreA"] and result["downloadedPngBytes"] > 10000)
        self.assertEqual(result["artifact"], "skill-web-artifacts-builder/bundle.html")
        self.assertEqual(result["pageErrors"], [])
        self.assertEqual(result["remoteRequests"], [])
        self.assertNotIn("baselineBytes", result)
        self.assertIn("browser-final-check.json", chapter)
        for filename in ("init-log.txt", "bundle-final-log.txt", "skill-comparison.png"):
            self.assertTrue((evidence / filename).is_file())

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
        self.assertTrue(all(
            path.name == "README.md"
            for path in (ROOT / "code/cases").rglob("*.md")
            if "node_modules" not in path.parts and "dist" not in path.parts
        ))

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
