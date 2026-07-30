from __future__ import annotations

import json
import re
from pathlib import Path

from compose_course import compose, load_manifest


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_RUNTIME_PROMPTS = [f"P{index:03d}" for index in range(1, 9)]
EXPECTED_UNITS = ["P001", "P002", "P003", "P005", "P006", "P008"]
EXPECTED_SKILLS = [f"S{index:03d}" for index in range(1, 9)]
EXPECTED_RUNTIME_LOOPS = [f"L{index:03d}" for index in range(1, 4)]
EXPECTED_LOOPS = [f"L{index:03d}" for index in range(1, 5)]
EXPECTED_LABS = EXPECTED_RUNTIME_PROMPTS + EXPECTED_SKILLS + EXPECTED_RUNTIME_LOOPS
EXPECTED_TEACHING = EXPECTED_UNITS + EXPECTED_SKILLS + EXPECTED_LOOPS
EXPECTED_BUSINESS = [f"B{index:03d}" for index in range(1, 25)]
S_CONTENT_HEADINGS = {
    "S001": ("### 五张任务卡的分诊结果", "### 这五个决定说明什么", "### 为什么“停下”也是正确结果"),
    "S002": ("### 数据体检记录", "### 六项缺失率", "### 为什么计算交给 Skill"),
    "S003": ("### 本地简报计算", "### 简报怎样说", "### 为什么要保留“不可计算”"),
    "S004": ("### 从原话到首个实验", "### 机会图", "### 为什么先画机会而不是功能"),
    "S005": ("### 三个方向怎样不同", "### 选中的预览", "### 为什么最终选择仍要交给人"),
    "S006": ("### 五页怎样对应大纲", "### 第四页和检查结果", "### 为什么生成后还要逐页看"),
    "S007": ("### 浏览器里测到什么", "### 运行画面", "### 原型离完整小游戏还有什么"),
    "S008": ("### 本地完成到哪里", "### 怎样查看", "### 本地检查与在线生成是两件事"),
}
BANNED_TEXT = (
    "讲师使用说明",
    "讲师工作坊",
    "证据边界",
    "失败分支",
    "重放暂缓与审批",
    "# 附录",
    "## 附录",
    "DASHSCOPE_API_KEY",
    "run_experiment.py",
    "Request ID",
    "本节清单在",
    "本部分不是纸面示例",
    "### 真实结果",
    "真实回答",
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dataset_case_ids(dataset_manifest: dict) -> list[str]:
    result: list[str] = []
    for item in dataset_manifest.get("datasets", []):
        result.extend(item.get("case_ids") or [item.get("case_id")])
    return result


def case_topology_errors(
    manifest_cases: list[dict],
    catalog_cases: list[dict],
    dataset_manifest: dict,
) -> list[str]:
    """Return plain consistency errors for the numbered business-case spine."""
    errors: list[str] = []
    manifest_ids = [str(item.get("id")) for item in manifest_cases]
    expected = [f"B{index:03d}" for index in range(1, len(manifest_ids) + 1)]
    catalog_ids = [str(item.get("id")) for item in catalog_cases]
    dataset_ids = [
        case_id
        for case_id in dataset_case_ids(dataset_manifest)
        if isinstance(case_id, str) and re.fullmatch(r"B\d{3}", case_id)
    ]

    if manifest_ids != expected:
        errors.append("manifest business ids are not contiguous")
    if catalog_ids != expected:
        errors.append("catalog business ids are not contiguous")
    if dataset_ids[: len(expected)] != expected:
        errors.append("dataset business ids are not contiguous")
    return errors


def verify_screenshot_links(
    text: str,
    errors: list[str],
    *,
    root: Path = ROOT,
    expected_count: int = 24,
) -> None:
    if re.search(r"sha-?256|\bsha256\b", text, flags=re.IGNORECASE):
        errors.append("Markdown must not expose SHA values")
    paths = re.findall(r"!\[[^\]]*\]\((\.\./evidence/screenshots/[^)]+\.png)\)", text)
    if len(set(paths)) < expected_count:
        errors.append(f"Markdown screenshot links {len(set(paths))} < {expected_count}")
    for relative in sorted(set(paths)):
        path = (root / "md" / relative).resolve()
        if root.resolve() not in path.parents:
            errors.append(f"screenshot path escapes course root: {relative}")
        elif not path.is_file():
            errors.append(f"missing screenshot: {relative}")
        elif path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            errors.append(f"invalid PNG signature: {relative}")


def verify_markdown_case(case_id: str, text: str, errors: list[str]) -> None:
    if "```mermaid" in text.lower():
        errors.append(f"{case_id} must not use Mermaid")
    for heading in ("问题", "数据", "解决方案", "CodeBuddy Prompt", "演示"):
        if not re.search(rf"^## {re.escape(heading)}\s*$", text, flags=re.MULTILINE):
            errors.append(f"{case_id} missing section: {heading}")


def section_map(text: str, pattern: str) -> dict[str, str]:
    matches = list(re.finditer(pattern, text, flags=re.MULTILINE))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[match.group(1)] = text[match.start():end]
    return sections


def main() -> int:
    errors: list[str] = []
    course_structure = load_manifest()
    text = compose(course_structure)
    manifest = load_json(ROOT / "course-manifest.json")
    datasets = load_json(ROOT / "dataset" / "manifest.json")

    expected_top_level = [
        "md/00-课程地图.md",
        "md/01-逻辑证据与AI基础.md",
        "md/02-Prompt工程.md",
        "md/03-Agent与Skill工程.md",
        "md/04-Grill-Harness-Loop.md",
        "md/05-产品与系统架构.md",
        "md/06-工程与交付.md",
        "md/07-案例地图.md",
        "md/08-课程项目.md",
    ]
    actual_top_level = [
        item["file"] for item in course_structure["sections"] if item.get("kind") == "chapter"
    ]
    if actual_top_level != expected_top_level:
        errors.append(f"canonical chapter sequence mismatch: {actual_top_level}")
    legacy_sources = [ROOT / "md" / "Course_AIProduct.md", *sorted((ROOT / "md").glob("[789][0-9]-*.md"))]
    for legacy in legacy_sources:
        if legacy.exists():
            errors.append(f"legacy duplicate Markdown remains: {legacy.relative_to(ROOT)}")
    if course_structure.get("output") != "output/Course_AIProduct.md":
        errors.append("single-file export must stay outside canonical md sources")

    if "```mermaid" in text.lower():
        errors.append("Markdown contains Mermaid; use scene-specific images or screenshots")
    for phrase in BANNED_TEXT:
        if phrase in text:
            errors.append(f"Markdown contains retired phrase: {phrase}")

    manifest_labs = manifest.get("labs", [])
    if [item.get("id") for item in manifest_labs] != EXPECTED_LABS:
        errors.append("manifest lab ids do not match P/S/L registry")
    teaching_spine = manifest.get("teaching_spine", {})
    if teaching_spine.get("prompt_units") != EXPECTED_UNITS:
        errors.append("manifest teaching Prompt units do not match P001-P008")
    if teaching_spine.get("agent_skill_workshops") != EXPECTED_SKILLS:
        errors.append("manifest teaching Skill workshops do not match S001-S008")
    if teaching_spine.get("loop_patterns") != EXPECTED_LOOPS:
        errors.append("manifest teaching Loop patterns do not match L001-L004")
    for item in manifest_labs:
        lab_id = str(item.get("id"))
        if not (ROOT / item.get("dataset_path", "")).is_dir():
            errors.append(f"{lab_id} dataset path missing")
        if not (ROOT / item.get("code_path", "")).is_dir():
            errors.append(f"{lab_id} code path missing")
        if lab_id in EXPECTED_RUNTIME_PROMPTS:
            if item.get("delivery") != "prompt_instructor_chapter":
                errors.append(f"{lab_id} must be a Prompt-first instructor chapter")
            if item.get("route"):
                errors.append(f"{lab_id} must not require a web route")

    unit_sections = section_map(text, r"^## (P\d{3})[^\n]*$")
    skill_sections = section_map(text, r"^## (S\d{3})[^\n]*$")
    loop_sections = section_map(text, r"^## (L\d{3})[^\n]*$")
    capability_sections = {**unit_sections, **skill_sections, **loop_sections}
    if list(capability_sections) != EXPECTED_TEACHING:
        errors.append(f"Markdown capability sequence mismatch: {list(capability_sections)}")
    for unit_id in EXPECTED_UNITS:
        section = capability_sections.get(unit_id, "")
        experiments = re.findall(r"^### 实验 ([123])：", section, flags=re.MULTILINE)
        if experiments != ["1", "2", "3"]:
            errors.append(f"{unit_id} experiment sequence mismatch: {experiments}")
        if len(re.findall(r"^(?:```|~~~)text\s*$", section, flags=re.MULTILINE)) < 3:
            errors.append(f"{unit_id} must contain three full Prompt inputs")
    for lab_id in EXPECTED_SKILLS:
        section = capability_sections.get(lab_id, "")
        for heading in ("### 场景", "### 交给 CodeBuddy", *S_CONTENT_HEADINGS[lab_id]):
            if heading not in section:
                errors.append(f"{lab_id} missing {heading}")
        if "code/skills/" not in section:
            errors.append(f"{lab_id} missing its Skill source path")

    prompt_skill_text = text[text.index("# 第一部分"):text.index("# 第三部分")]
    if "```powershell" in prompt_skill_text.lower():
        errors.append("Prompt and Agent+Skills chapters must not contain PowerShell runbooks")

    business_sections = section_map(text, r"^# 综合案例 (B\d{3})[^\n]*$")
    if list(business_sections) != EXPECTED_BUSINESS:
        errors.append(f"Markdown business sequence mismatch: {list(business_sections)}")
    for case_id in EXPECTED_BUSINESS:
        section = business_sections.get(case_id, "")
        if not re.search(r"^## 需求\s*$", section, flags=re.MULTILINE):
            errors.append(f"{case_id} missing section: 需求")
        verify_markdown_case(case_id, section, errors)

    runtime_ids = [f"B{index:03d}" for index in range(1, 25)]
    manifest_cases = manifest.get("cases", [])
    if [item.get("id") for item in manifest_cases] != runtime_ids:
        errors.append("manifest runtime ids are not B001-B024")
    for runtime_id, item in zip(runtime_ids, manifest_cases, strict=False):
        if item.get("route") != f"/cases/{runtime_id}":
            errors.append(f"{runtime_id} public route mismatch")
        code_path = ROOT / item.get("code_path", "")
        if not (code_path / "contract.json").is_file() or not (code_path / "index.ts").is_file():
            errors.append(f"{runtime_id} code contract incomplete")

    expected_dataset_ids = runtime_ids + EXPECTED_LABS
    if dataset_case_ids(datasets) != expected_dataset_ids:
        errors.append("dataset manifest does not cover B001-B024 plus P/S/L in order")

    verify_screenshot_links(text, errors, expected_count=24)

    if errors:
        print("COURSE VERIFICATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "COURSE VERIFICATION PASSED "
        f"teaching_units={len(EXPECTED_TEACHING)} business_cases={len(EXPECTED_BUSINESS)} "
        "business_screenshots>=24"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
