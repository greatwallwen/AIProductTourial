from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    errors: list[str] = []

    knowledge_map = load_json(ROOT / "md" / "logic-knowledge-map.json")
    lessons = knowledge_map.get("lessons", [])
    expected_ids = [f"L{index:02d}" for index in range(1, 51)]
    actual_ids = [lesson.get("sourceId") for lesson in lessons]
    if actual_ids != expected_ids:
        errors.append("logic knowledge map must contain ordered L01-L50 exactly once")
    allowed_dispositions = {"retain", "merge", "condense", "omit"}
    if any(lesson.get("disposition") not in allowed_dispositions for lesson in lessons):
        errors.append("logic knowledge map contains an unknown disposition")
    disposition_counts = Counter(lesson.get("disposition") for lesson in lessons)
    summary = knowledge_map.get("summary", {})
    expected_summary = {
        "sourceLessons": len(lessons),
        "retained": disposition_counts["retain"],
        "merged": disposition_counts["merge"],
        "condensed": disposition_counts["condense"],
        "omitted": disposition_counts["omit"],
    }
    if summary != expected_summary:
        errors.append(f"logic knowledge map summary mismatch: {summary} != {expected_summary}")
    target_ids = [target for lesson in lessons for target in lesson.get("targetIds", [])]
    if not target_ids or any(not re.fullmatch(r"[123]\.\d+\.\d+", target) for target in target_ids):
        errors.append("every source lesson must map to a three-level target ID")

    chapter = (ROOT / "md" / "01-逻辑证据与AI基础.md").read_text(encoding="utf-8")
    expected_headings = [
        "# 第1章 从想法到可以判断的命题",
        "## 1.1 先把想法拆开",
        "## 1.2 事实、观点与命题",
        "## 1.3 条件、范围与判断边界",
        "## 1.4 模型回答也要逐句验明身份",
        "## 1.5 综合案例：一条投诉需求怎样变成系统规则",
    ]
    for heading in expected_headings:
        if chapter.count(heading) != 1:
            errors.append(f"missing or duplicate chapter heading: {heading}")
    if re.search(r"^####+\s", chapter, flags=re.MULTILINE):
        errors.append("foundation chapter must not use a fourth numbered level")
    required_content = (
        "小区快递柜",
        "观察",
        "命题",
        "前提",
        "推断",
        "动作",
        "qwen-plus",
        "P001-smartphone-review-contract",
        "MIIT-2025-Q2",
        "CN-TEL-2025Q2-0008",
        "404",
        "393",
        "114",
        "89",
    )
    for phrase in required_content:
        if phrase not in chapter:
            errors.append(f"foundation chapter missing required material: {phrase}")
    forbidden = ("优质回答", "讲师使用说明", "证据边界", "失败分支", "Request ID", "SHA-256")
    for phrase in forbidden:
        if phrase in chapter:
            errors.append(f"foundation chapter contains retired wording: {phrase}")

    chapter_two = (ROOT / "md" / "CH02-推理链.md").read_text(encoding="utf-8")
    chapter_three = (ROOT / "md" / "CH03-从样本到结论.md").read_text(encoding="utf-8")
    for heading in (
        "# 第2章 把命题连成可检查的推理链",
        "## 2.1 把一句规则写成逻辑关系",
        "## 2.2 一致性比“听起来合理”更重要",
        "## 2.3 从规则和事实推出动作",
        "## 2.4 识别几种最贵的逻辑跳跃",
        "## 2.5 反例会让结论回到合适的范围",
        "## 2.6 综合案例：一次投诉怎样穿过分派、复核和关闭",
    ):
        if chapter_two.count(heading) != 1:
            errors.append(f"missing or duplicate chapter two heading: {heading}")
    for heading in (
        "# 第3章 从样本走向可验证的结论",
        "## 3.1 数据不是数字堆，归纳也不是凭经验",
        "## 3.2 先看分布，再看一个平均数",
        "## 3.3 样本能代表谁，取决于怎样抽",
        "## 3.4 调查观察世界，实验主动制造比较",
        "## 3.5 相关、回归和因果各回答不同问题",
        "## 3.6 从局部结论回到现实世界",
        "## 3.7 综合案例：8 元券到底带来了多少增量",
    ):
        if chapter_three.count(heading) != 1:
            errors.append(f"missing or duplicate chapter three heading: {heading}")
    if re.search(r"^####+\s", chapter_two + "\n" + chapter_three, flags=re.MULTILINE):
        errors.append("foundation chapters must not use a fourth numbered level")
    for phrase in ("BT-0044", "证伪", "三段论"):
        if phrase not in chapter_two:
            errors.append(f"chapter two missing required material: {phrase}")
    for phrase in ("NIST", "国家统计局", "B002", "1,920 元", "随机"):
        if phrase not in chapter_three:
            errors.append(f"chapter three missing required material: {phrase}")

    data_path = ROOT / "dataset" / "B010-telecom-complaint-orchestration" / "case.csv"
    with data_path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    categories = Counter(row["category"] for row in rows)
    scenarios = Counter(row["external_lookup_scenario"] for row in rows)
    if len(rows) != 1000:
        errors.append(f"B010 row count changed: {len(rows)}")
    if categories != {"资费争议": 404, "服务争议": 393, "营销争议": 114, "其他": 89}:
        errors.append(f"B010 category distribution changed: {dict(categories)}")
    if scenarios != {
        "not_committed": 334,
        "committed_response_lost": 333,
        "effect_status_unknown": 333,
    }:
        errors.append(f"B010 scenario distribution changed: {dict(scenarios)}")

    structure = load_json(ROOT / "md" / "course-structure.json")
    architecture = structure.get("knowledge_architecture", [])
    architecture_ids = [entry.get("id") for entry in architecture]
    if architecture_ids != [f"CH{index:02d}" for index in range(0, 11)]:
        errors.append(f"knowledge architecture IDs mismatch: {architecture_ids}")
    if architecture[1].get("file") != "md/01-逻辑证据与AI基础.md":
        errors.append("CH01 must point to the completed foundation chapter")
    if architecture[2].get("file") != "md/CH02-推理链.md" or architecture[2].get("status") != "complete":
        errors.append("CH02 must point to the completed reasoning-chain chapter")
    if architecture[3].get("file") != "md/CH03-从样本到结论.md" or architecture[3].get("status") != "complete":
        errors.append("CH03 must point to the completed induction chapter")

    visual_ledger = load_json(ROOT / "sources" / "logic-foundation-sources.json")
    for visual in visual_ledger.get("visuals", []):
        asset = ROOT / visual["path"]
        if not asset.exists():
            errors.append(f"missing foundation visual: {visual['path']}")
        if not visual.get("basis"):
            errors.append(f"foundation visual lacks source or redraw basis: {visual['path']}")
    for target in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", chapter):
        resolved = (ROOT / "md" / target).resolve()
        if not resolved.exists():
            errors.append(f"foundation chapter image missing: {target}")

    if errors:
        print("logic foundation verification failed")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "logic foundation verified: "
        f"lessons={len(lessons)}, foundation_chapters=3, B010_rows={len(rows)}, "
        f"visuals={len(visual_ledger.get('visuals', []))}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
