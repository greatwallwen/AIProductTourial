from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTER = ROOT / "md" / "Course_AIProduct.md"
COMPOSED_MD_DIR = ROOT / "md"

REQUIRED_HEADINGS = (
    "需求",
    "问题",
    "数据",
    "解决方案",
    "CodeBuddy Prompt",
    "演示",
    "实现与排错",
)

FORBIDDEN = (
    "讲师使用说明",
    "讲师工作坊",
    "证据边界",
    "失败分支",
    "治理闭环",
    "重放暂缓与审批",
    "```mermaid",
    "SHA-256",
)


def local_target(relative: str) -> Path:
    return (COMPOSED_MD_DIR / relative).resolve()


def main() -> int:
    text = CHAPTER.read_text(encoding="utf-8")
    errors: list[str] = []
    starts = list(re.finditer(r"(?m)^# 综合案例 (B\d{2})\s+(.+)$", text))
    expected_ids = [f"B{number:02d}" for number in range(1, 21)]
    actual_ids = [match.group(1) for match in starts]
    if actual_ids != expected_ids:
        errors.append(f"expected B01-B20 in order, got {actual_ids}")

    for index, match in enumerate(starts):
        case_id = match.group(1)
        end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
        block = text[match.start() : end]

        for heading in REQUIRED_HEADINGS:
            if not re.search(rf"(?m)^## {re.escape(heading)}$", block):
                errors.append(f"{case_id} missing section: {heading}")

        if "```text" not in block or not re.search(r"(?:请实现案例|实现[“\"])", block):
            errors.append(f"{case_id} missing copyable CodeBuddy build Prompt")
        has_operation = "**操作**" in block or re.search(r"(?m)^1\. ", block) is not None
        if not has_operation or "**结果**" not in block:
            errors.append(f"{case_id} missing demo operation/result")
        if not any(word in block for word in ("不能", "缺少", "缺失", "待补", "不得")):
            errors.append(f"{case_id} does not state what remains unknown or disallowed")
        if "- 排查：若" not in block:
            errors.append(f"{case_id} missing a concrete error symptom")

        expected_assets = {
            "screenshot": rf"\.\./assets/cases/case-{int(case_id[1:]):02d}/{int(case_id[1:]):02d}-work-productized\.png",
            "requirement": rf"\.\./assets/case-diagrams/{case_id}-requirement\.svg",
            "architecture": rf"\.\./assets/case-diagrams/{case_id}-architecture\.svg",
        }
        for kind, pattern in expected_assets.items():
            matches = re.findall(pattern, block)
            if len(matches) != 1:
                errors.append(f"{case_id} expected one {kind} image, got {len(matches)}")

        links = re.findall(r"\]\((\.\./(?:assets|evidence|code)/[^)]+)\)", block)
        for link in links:
            target = local_target(link.rstrip("/"))
            if not target.exists():
                errors.append(f"{case_id} broken local link: {link}")

        code_links = [link for link in links if link.startswith("../code/cases/")]
        test_links = [link for link in links if link.startswith("../code/app/tests/")]
        if len(code_links) != 1:
            errors.append(f"{case_id} expected one case-code link, got {len(code_links)}")
        if len(test_links) != 1:
            errors.append(f"{case_id} expected one focused-test link, got {len(test_links)}")

        for suffix in ("requirement", "architecture"):
            svg = ROOT / "assets" / "case-diagrams" / f"{case_id}-{suffix}.svg"
            try:
                root = ET.parse(svg).getroot()
            except (ET.ParseError, OSError) as error:
                errors.append(f"{case_id} invalid {suffix} SVG: {error}")
                continue
            if root.attrib.get("viewBox") != "0 0 1600 900":
                errors.append(f"{case_id} {suffix} SVG is not 1600x900")
            visible_text = "".join(root.itertext())
            if case_id not in visible_text or len(re.findall(r"[\u4e00-\u9fff]", visible_text)) < 30:
                errors.append(f"{case_id} {suffix} SVG lacks sufficient Chinese labels")

    for phrase in FORBIDDEN:
        if phrase in text:
            errors.append(f"forbidden course wording: {phrase}")

    if errors:
        print("BUSINESS CASE CONTRACTS FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "BUSINESS CASE CONTRACTS PASSED "
        f"cases={len(starts)} screenshots={len(starts)} diagrams={len(starts) * 2} "
        f"code_links={len(starts)} test_links={len(starts)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
