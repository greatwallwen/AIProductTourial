from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from compose_course import compose, load_manifest, output_path


ROOT = Path(__file__).resolve().parents[1]

RETIRED_HEADINGS = {
    "需求",
    "问题",
    "数据",
    "解决方案",
    "CodeBuddy Prompt",
    "演示",
    "实现与排错",
}

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


def local_target(relative: str, composed_dir: Path) -> Path:
    return (composed_dir / relative).resolve()


def main() -> int:
    course_structure = load_manifest()
    text = compose(course_structure)
    composed_dir = output_path(course_structure).parent
    errors: list[str] = []
    starts = list(re.finditer(r"(?m)^### 综合案例 (B\d{3})\s+(.+)$", text))
    expected_ids = [f"B{number:03d}" for number in range(1, 25)]
    actual_ids = [match.group(1) for match in starts]
    if actual_ids != expected_ids:
        errors.append(f"expected B001-B024 in order, got {actual_ids}")

    for index, match in enumerate(starts):
        case_id = match.group(1)
        end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
        block = text[match.start() : end]

        headings = re.findall(r"(?m)^#### ([^\n]+)$", block)
        if len(headings) != 3 or len(set(headings)) != 3:
            errors.append(f"{case_id} expected three distinct narrative sections, got {headings}")
        if RETIRED_HEADINGS.intersection(headings):
            errors.append(f"{case_id} still uses the retired seven-heading template")

        if "```text" not in block or not re.search(r"(?:请实现案例|实现[“\"])", block):
            errors.append(f"{case_id} missing copyable CodeBuddy build Prompt")
        if not any(word in block for word in ("不能", "缺少", "缺失", "待补", "不得")):
            errors.append(f"{case_id} does not state what remains unknown or disallowed")
        if "**代码与排查**" not in block or "若" not in block:
            errors.append(f"{case_id} missing a concrete error symptom")

        expected_assets = {
            "requirement": rf"\.\./assets/case-diagrams/{case_id}-requirement\.svg",
            "architecture": rf"\.\./assets/case-diagrams/{case_id}-architecture\.svg",
        }
        for kind, pattern in expected_assets.items():
            matches = re.findall(pattern, block)
            if len(matches) != 1:
                errors.append(f"{case_id} expected one {kind} image, got {len(matches)}")
        screenshots = re.findall(r"\.\./evidence/screenshots/[^)]+\.png", block)
        if len(screenshots) != 1:
            errors.append(f"{case_id} expected one screenshot image, got {len(screenshots)}")

        links = re.findall(r"\]\((\.\./(?:assets|evidence|code)/[^)]+)\)", block)
        for link in links:
            target = local_target(link.rstrip("/"), composed_dir)
            if not target.exists():
                errors.append(f"{case_id} broken local link: {link}")

        code_links = [link for link in links if link.startswith("../code/cases/")]
        if len(code_links) != 1:
            errors.append(f"{case_id} expected one case-code link, got {len(code_links)}")

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
        f"code_links={len(starts)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
