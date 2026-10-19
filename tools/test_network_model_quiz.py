import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "code/cases/network-model-quiz/index.html"
QUESTIONS = ROOT / "dataset/cases/network-model-quiz/questions.json"


class NetworkModelQuizTests(unittest.TestCase):
    def test_question_set_matches_page(self):
        questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
        page = PAGE.read_text(encoding="utf-8")
        self.assertEqual(len(questions), 11)
        self.assertEqual(
            {question["type"] for question in questions},
            {"single", "multi", "truefalse", "fill", "short", "comprehensive"},
        )
        self.assertEqual(
            [question["id"] for question in questions],
            re.findall(r"\{ id:'(q\d+)', type:", page),
        )
        embedded = subprocess.run(
            [
                "node",
                "-e",
                "const fs=require('fs'),vm=require('vm');"
                "const text=fs.readFileSync(process.argv[1],'utf8');"
                "const match=text.match(/const questions = (\\[[\\s\\S]*?\\n  \\]);/);"
                "if(!match)process.exit(1);"
                "process.stdout.write(JSON.stringify(vm.runInNewContext('('+match[1]+')')));",
                str(PAGE),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        for source, rendered in zip(questions, json.loads(embedded.stdout), strict=True):
            for key in ("id", "type", "topic", "prompt", "evidence", "options", "answer"):
                if key in source:
                    self.assertEqual(source[key], rendered[key], f"{source['id']}: {key}")
            if "answer_text" in source:
                self.assertEqual(source["answer_text"], rendered["answerText"])
            if "answer_points" in source:
                self.assertEqual(source["answer_points"], rendered["points"])
            if "accepted" in source:
                self.assertEqual(
                    [answer.lower() for answer in source["accepted"]],
                    rendered["accepted"],
                )

    def test_public_page_uses_reader_owned_pdf(self):
        page = PAGE.read_text(encoding="utf-8")
        self.assertIn('id="source-pdf"', page)
        self.assertIn('id="pdf-view"', page)
        self.assertIn("URL.createObjectURL", page)
        self.assertNotIn("../../../案例素材/", page)

    def test_course_links_resolve(self):
        documents = (
            ROOT / "md/04-案例与实践篇/09-通用Skill案例-办公与表达.md",
            ROOT / "md/04-案例与实践篇/09-通用Skill案例-办公与表达.md",
            ROOT / "md/案例索引.md",
        )
        for document in documents:
            for target in re.findall(r"!?\[[^\]]+\]\(([^)]+)\)", document.read_text(encoding="utf-8")):
                with self.subTest(document=document.name, target=target):
                    self.assertTrue((document.parent / target.split('#', 1)[0]).resolve().exists())


if __name__ == "__main__":
    unittest.main()
