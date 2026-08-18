from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN = ROOT / "md" / "Course_AIProduct.md"
S_CONTENT_HEADINGS = {
    "S01": ("### 五张任务卡的分诊结果", "### 这五个决定说明什么", "### 为什么“停下”也是正确结果"),
    "S02": ("### 数据体检记录", "### 六项缺失率", "### 为什么计算交给 Skill"),
    "S03": ("### 本地简报计算", "### 简报怎样说", "### 为什么要保留“不可计算”"),
    "S04": ("### 从原话到首个实验", "### 机会图", "### 为什么先画机会而不是功能"),
    "S05": ("### 三个方向怎样不同", "### 选中的预览", "### 为什么最终选择仍要交给人"),
    "S06": ("### 五页怎样对应大纲", "### 第四页和检查结果", "### 为什么生成后还要逐页看"),
    "S07": ("### 浏览器里测到什么", "### 运行画面", "### 原型离完整小游戏还有什么"),
    "S08": ("### 本地完成到哪里", "### 怎样查看", "### 本地检查与在线生成是两件事"),
}


def sections(text: str, pattern: str) -> dict[str, str]:
    matches = list(re.finditer(pattern, text, flags=re.MULTILINE))
    result: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        result[match.group(1)] = text[match.start():end]
    return result


def main() -> int:
    errors: list[str] = []
    text = MARKDOWN.read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "course-manifest.json").read_text(encoding="utf-8"))

    capability_sections = sections(text, r"^## ([USL]\d{2})\b")
    u_sections = {key: value for key, value in capability_sections.items() if key.startswith("U")}
    s_sections = {key: value for key, value in capability_sections.items() if key.startswith("S")}
    l_sections = {key: value for key, value in capability_sections.items() if key.startswith("L")}
    b_sections = sections(text, r"^# 综合案例 (B\d{2})\b")

    expected = {
        "U": manifest["teaching_spine"]["prompt_units"],
        "S": manifest["teaching_spine"]["agent_skill_workshops"],
        "L": manifest["teaching_spine"]["loop_patterns"],
        "B": manifest["teaching_spine"]["business_cases"],
    }
    actual = {
        "U": list(u_sections),
        "S": list(s_sections),
        "L": list(l_sections),
        "B": list(b_sections),
    }
    for track in expected:
        if actual[track] != expected[track]:
            errors.append(f"{track} headings mismatch: {actual[track]}")

    for unit_id, section in u_sections.items():
        experiments = re.findall(r"^### 实验 ([123])：", section, flags=re.MULTILINE)
        if experiments != ["1", "2", "3"]:
            errors.append(f"{unit_id} experiment sequence mismatch: {experiments}")
        if len(re.findall(r"^(?:```|~~~)text\s*$", section, flags=re.MULTILINE)) < 3:
            errors.append(f"{unit_id} must contain three full Prompt inputs")

    for case_id, section in s_sections.items():
        for required in ("### 场景", "### 交给 CodeBuddy", *S_CONTENT_HEADINGS[case_id]):
            if required not in section:
                errors.append(f"{case_id} missing {required}")
        if "code/skills/" not in section:
            errors.append(f"{case_id} missing its Skill source path")

    for case_id, section in l_sections.items():
        if "```" not in section:
            errors.append(f"{case_id} missing an inspectable state trace")
        if case_id != "L04" and not re.search(r"\]\(\.\./runtime/loop-runtime/[^)]+\)", section):
            errors.append(f"{case_id} missing its runtime artifact link")
        if case_id == "L04" and "pixijs-game-contract" not in section:
            errors.append("L04 missing its code-test-debug example")

    for case_id, section in b_sections.items():
        for required in ("## 问题", "## 数据", "## 解决方案", "## CodeBuddy Prompt", "## 演示"):
            if required not in section:
                errors.append(f"{case_id} missing {required}")
        runtime_screenshots = re.findall(
            r"!\[[^\]]*\]\(\.\./assets/cases/case-\d{2}/\d{2}-work-productized\.png\)",
            section,
        )
        if len(runtime_screenshots) != 1:
            errors.append(f"{case_id} must contain exactly one runtime screenshot")

    forbidden = (
        "讲师使用说明",
        "讲师工作坊",
        "证据边界",
        "失败分支",
        "# 附录",
        "```mermaid",
        "SHA-256",
        "DASHSCOPE_API_KEY",
        "run_experiment.py",
        "Request ID",
        "本节清单在",
        "本部分不是纸面示例",
        "### 真实结果",
        "真实回答",
    )
    for phrase in forbidden:
        if phrase in text:
            errors.append(f"forbidden wording: {phrase}")

    first_two_parts = text.split("# 第一部分", 1)[1].split("# 第三部分", 1)[0]
    if re.search(r"^(```|~~~)powershell\b", first_two_parts, flags=re.MULTILINE):
        errors.append("Prompt and Agent+Skills teaching still contains a PowerShell runbook")
    for command_fragment in ("python -B ", "npm run ", "pnpm ", "npx "):
        if command_fragment in first_two_parts:
            errors.append(
                "Prompt and Agent+Skills teaching still contains an engineering command: "
                f"{command_fragment.strip()}"
            )
    if re.search(r"^# 案例 \d{2}", text, flags=re.MULTILINE):
        errors.append("old numeric case headings remain")
    if re.search(r"案例 (?:2[1-9]|3[0-6])\b", text):
        errors.append("old capability case references remain")

    for target in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text):
        if re.match(r"^[a-z]+://", target):
            continue
        resolved = (MARKDOWN.parent / target).resolve()
        if ROOT.resolve() not in resolved.parents and resolved != ROOT.resolve():
            errors.append(f"image escapes course root: {target}")
        elif not resolved.exists():
            errors.append(f"missing image: {target}")

    for target in re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", text):
        if re.match(r"^[a-z]+://", target) or target.startswith("#"):
            continue
        path_part = unquote(target.split("#", 1)[0].strip("<>"))
        resolved = (MARKDOWN.parent / path_part).resolve()
        if ROOT.resolve() not in resolved.parents and resolved != ROOT.resolve():
            errors.append(f"link escapes course root: {target}")
        elif not resolved.exists():
            errors.append(f"missing link: {target}")

    if errors:
        print("curriculum spine verification failed")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "curriculum spine verified: "
        f"U={len(u_sections)}, S={len(s_sections)}, "
        f"L={len(l_sections)}, B={len(b_sections)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
