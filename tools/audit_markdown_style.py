from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from compose_course import compose, load_manifest


ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "md" / "cases"

RETIRED_CASE_HEADINGS = {
    "需求",
    "问题",
    "数据",
    "解决方案",
    "CodeBuddy Prompt",
    "演示",
    "实现与排错",
}

RETIRED_PROSE = (
    "讲师使用说明",
    "讲师工作坊",
    "证据边界",
    "失败分支",
    "重放暂缓与审批",
    "本部分不是纸面示例",
    "本节清单在",
    "Request ID",
    "SHA-256",
    "综上所述",
    "值得注意的是",
    "治理闭环",
)

CASE_GROUPS = (
    "经营与公共服务：材料不全时怎样继续工作",
    "复杂系统协作：一次操作怎样跨过多道门",
    "工业与现场运营：先定位核查范围，不抢着诊断",
    "日常数据产品：少一点猜测，多一个可交接决定",
)


def audit() -> dict:
    manifest = load_manifest()
    text = compose(manifest)
    errors: list[str] = []
    headings = re.findall(r"^(#{1,6})\s+(.+)$", text, flags=re.MULTILINE)
    shallow = sum(len(marks) <= 3 for marks, _ in headings)
    repeated = Counter(title for _, title in headings)

    if shallow > 230:
        errors.append(f"level-one through level-three headings {shallow} > 230")
    if len(headings) > 220:
        errors.append(f"all visible headings {len(headings)} > 220")
    for title, count in repeated.items():
        if count > 4:
            errors.append(f"heading repeated {count} times: {title}")

    for phrase in RETIRED_PROSE:
        if phrase in text:
            errors.append(f"retired course wording remains: {phrase}")
    if "讲师" in text:
        errors.append("reader-facing course still refers to the instructor as a UI state")
    if "离线重放" in text:
        errors.append("reader-facing course still uses offline replay process wording")

    contrast_pairs = len(re.findall(r"不是[^。\n]{0,50}而是", text))
    if contrast_pairs > 30:
        errors.append(f"formulaic '不是…而是…' constructions {contrast_pairs} > 30")
    if text.count("真正") > 16:
        errors.append(f"formulaic '真正' occurrences {text.count('真正')} > 16")

    for group in CASE_GROUPS:
        if text.count(f"## {group}") != 1:
            errors.append(f"missing or duplicate case group: {group}")

    case_headings: list[str] = []
    case_files = sorted(CASES.glob("B*.md"))
    if len(case_files) != 24:
        errors.append(f"case source count {len(case_files)} != 24")
    for path in case_files:
        case_id = path.name[:4]
        source = path.read_text(encoding="utf-8")
        section_headings = re.findall(r"^## ([^\n]+)$", source, flags=re.MULTILINE)
        if len(section_headings) != 3 or len(set(section_headings)) != 3:
            errors.append(f"{case_id} must have three distinct scene-specific sections")
        if RETIRED_CASE_HEADINGS.intersection(section_headings):
            errors.append(f"{case_id} uses a retired template heading")
        case_headings.extend(section_headings)
        if source.count("```text") < 1 or "CodeBuddy" not in source:
            errors.append(f"{case_id} lost its copyable CodeBuddy Prompt")
        if source.count("![") != 3:
            errors.append(f"{case_id} must keep one screenshot and two diagrams")
    duplicates = [title for title, count in Counter(case_headings).items() if count > 1]
    if duplicates:
        errors.append(f"case-specific headings are duplicated: {duplicates}")

    if len(re.findall(r"^### 实验 [123]：", text, flags=re.MULTILINE)) != 18:
        errors.append("Prompt experiment count must remain 18")
    if re.search(r"^### (?:场景|交给 CodeBuddy)$", text, flags=re.MULTILINE):
        errors.append("worksheet-style repeated Skill or Agent headings remain")

    return {
        "schemaVersion": "1.0",
        "status": "passed" if not errors else "failed",
        "measurements": {
            "characters": len(text),
            "lines": text.count("\n") + 1,
            "allHeadings": len(headings),
            "levelOneToThreeHeadings": shallow,
            "maximumHeadingRepeat": max(repeated.values(), default=0),
            "formulaicContrastPairs": contrast_pairs,
            "realWordOccurrences": text.count("真正"),
            "promptExperiments": len(
                re.findall(r"^### 实验 [123]：", text, flags=re.MULTILINE)
            ),
            "businessCases": len(case_files),
            "caseNarrativeHeadings": len(case_headings),
            "caseGroups": len(CASE_GROUPS),
        },
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit()
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        output = args.output if args.output.is_absolute() else ROOT / args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(encoded, encoding="utf-8", newline="\n")
    print(encoded, end="")
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
