from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = (
    ("md/01-逻辑证据与AI基础.md", 1, "从想法到可以判断的命题"),
    ("md/CH02-推理链.md", 2, "把命题连成可检查的推理链"),
    ("md/CH03-从样本到结论.md", 3, "从样本走向可验证的结论"),
    ("md/02-Prompt工程.md", 4, "Prompt：把工作说清楚"),
    ("md/03-Agent与Skill工程.md", 5, "Agent + Skills：把一次回答变成一件做完的事"),
    ("md/04-Grill-Harness-Loop.md", 6, "Grill、Harness 与 Loop：把任务做完，也知道何时停"),
    ("md/05-产品与系统架构.md", 7, "从业务决定到可运行系统"),
    ("md/06-工程与交付.md", 8, "工程与交付：让系统经得起修改、失败和上线"),
    ("md/07-案例地图.md", 9, "二十四个综合业务案例"),
    ("md/08-课程项目.md", 10, "从自己的问题开始"),
)
HEADING = re.compile(r"^(#{1,6})\s+(.+)$")
FENCE = re.compile(r"^\s*(```|~~~)")


def prose_headings(path: Path) -> list[tuple[int, str]]:
    headings: list[tuple[int, str]] = []
    in_fence = False
    fence_marker: str | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        fence_match = FENCE.match(line)
        if fence_match:
            marker = fence_match.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = None
            continue
        if in_fence:
            continue
        match = HEADING.match(line)
        if match:
            headings.append((len(match.group(1)), match.group(2)))
    return headings


def main() -> int:
    errors: list[str] = []
    for relative, chapter, title in CHAPTERS:
        path = ROOT / relative
        headings = prose_headings(path)
        h1 = [text for level, text in headings if level == 1]
        expected_h1 = f"第{chapter}章 {title}"
        if h1 != [expected_h1]:
            errors.append(f"{relative} H1 mismatch: {h1}")
        if any(level >= 4 for level, _ in headings):
            errors.append(f"{relative} contains a fourth prose heading level")

        section_numbers: list[int] = []
        point_numbers: dict[int, list[int]] = {}
        current_section: int | None = None
        for level, text in headings:
            if level == 2:
                match = re.match(rf"{chapter}\.(\d+)\s+", text)
                if not match:
                    errors.append(f"{relative} unnumbered H2: {text}")
                    current_section = None
                    continue
                current_section = int(match.group(1))
                section_numbers.append(current_section)
                point_numbers.setdefault(current_section, [])
            elif level == 3:
                match = re.match(rf"{chapter}\.(\d+)\.(\d+)\s+", text)
                if not match:
                    errors.append(f"{relative} unnumbered H3: {text}")
                    continue
                parent, point = map(int, match.groups())
                if parent != current_section:
                    errors.append(f"{relative} H3 is under the wrong H2: {text}")
                point_numbers.setdefault(parent, []).append(point)

        if section_numbers and section_numbers != list(range(1, len(section_numbers) + 1)):
            errors.append(f"{relative} H2 sequence mismatch: {section_numbers}")
        for section, points in point_numbers.items():
            if points and points != list(range(1, len(points) + 1)):
                errors.append(f"{relative} H3 sequence mismatch in {chapter}.{section}: {points}")

    prompt = (ROOT / "md" / "02-Prompt工程.md").read_text(encoding="utf-8")
    skills = (ROOT / "md" / "03-Agent与Skill工程.md").read_text(encoding="utf-8")
    loops = (ROOT / "md" / "04-Grill-Harness-Loop.md").read_text(encoding="utf-8")
    if re.findall(r"^## 4\.\d+ (第[一二三四五六]步)\b", prompt, flags=re.MULTILINE) != [
        "第一步", "第二步", "第三步", "第四步", "第五步", "第六步"
    ]:
        errors.append("Prompt step identifiers changed")
    if re.findall(r"^## 5\.\d+ (S\d{3})\b", skills, flags=re.MULTILINE) != [
        f"S{index:03d}" for index in range(1, 10)
    ]:
        errors.append("Skill identifiers changed")
    if re.findall(r"^## 6\.\d+ (L\d{3})\b", loops, flags=re.MULTILINE) != [
        f"L{index:03d}" for index in range(1, 5)
    ]:
        errors.append("Loop identifiers changed")

    if errors:
        print("numbered course verification failed")
        for error in errors:
            print(f"- {error}")
        return 1
    print("numbered course verified: chapters=10, stable_units=P6/S9/L4")
    return 0


if __name__ == "__main__":
    sys.exit(main())
