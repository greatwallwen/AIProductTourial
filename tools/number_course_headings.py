from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = (
    (ROOT / "md" / "02-Prompt工程.md", 4, "Prompt：把工作说清楚"),
    (ROOT / "md" / "03-Agent与Skill工程.md", 5, "Agent + Skills：把一次回答变成一件做完的事"),
    (ROOT / "md" / "04-Grill-Harness-Loop.md", 6, "Grill、Harness 与 Loop：把任务做完，也知道何时停"),
    (ROOT / "md" / "05-产品与系统架构.md", 7, "从业务决定到可运行系统"),
    (ROOT / "md" / "06-工程与交付.md", 8, "工程与交付：让系统经得起修改、失败和上线"),
    (ROOT / "md" / "07-案例地图.md", 9, "二十四个综合业务案例"),
    (ROOT / "md" / "08-课程项目.md", 10, "从自己的问题开始"),
)
NUMBER_PREFIX = re.compile(r"^\d+(?:\.\d+){1,2}\s+")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)(\r?\n)?$")
FENCE = re.compile(r"^\s*(```|~~~)")


def strip_number(title: str) -> str:
    return NUMBER_PREFIX.sub("", title).strip()


def normalized(path: Path, chapter: int, chapter_title: str) -> str:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    output: list[str] = []
    in_fence = False
    fence_marker: str | None = None
    h1_count = 0
    section = 0
    point = 0

    for line in lines:
        fence_match = FENCE.match(line)
        if fence_match:
            marker = fence_match.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = None
            output.append(line)
            continue
        if in_fence:
            output.append(line)
            continue

        match = HEADING.match(line)
        if not match:
            output.append(line)
            continue
        marks, raw_title, ending = match.groups()
        ending = ending or ""
        level = len(marks)
        title = strip_number(raw_title)

        if level == 1:
            h1_count += 1
            output.append(f"# 第{chapter}章 {chapter_title}{ending}")
        elif level == 2:
            section += 1
            point = 0
            output.append(f"## {chapter}.{section} {title}{ending}")
        elif level == 3:
            if section == 0:
                raise ValueError(f"{path}: H3 appears before the first H2")
            point += 1
            output.append(f"### {chapter}.{section}.{point} {title}{ending}")
        else:
            output.append(f"**{title}**{ending}")

    if h1_count != 1:
        raise ValueError(f"{path}: expected one prose H1 outside code fences, found {h1_count}")
    return "".join(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale: list[str] = []

    for path, chapter, title in CHAPTERS:
        current = path.read_text(encoding="utf-8")
        expected = normalized(path, chapter, title)
        if current == expected:
            continue
        if args.check:
            stale.append(path.relative_to(ROOT).as_posix())
        else:
            path.write_text(expected, encoding="utf-8", newline="\n")

    if stale:
        print("course heading numbering is stale")
        for path in stale:
            print(f"- {path}")
        return 1
    print(f"course heading numbering {'verified' if args.check else 'applied'}: chapters=7")
    return 0


if __name__ == "__main__":
    sys.exit(main())
