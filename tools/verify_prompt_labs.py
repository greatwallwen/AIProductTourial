from __future__ import annotations

import csv
import re
import sys
from collections import Counter
from pathlib import Path

from compose_course import compose, load_manifest


ROOT = Path(__file__).resolve().parents[1]
PROMPT_STEPS = ["第一步", "第二步", "第三步", "第四步", "第五步", "第六步"]


def fail(errors: list[str]) -> int:
    print("PROMPT LABS FAILED")
    for error in errors:
        print(f"- {error}")
    return 1


def main() -> int:
    text = compose(load_manifest())
    errors: list[str] = []

    units = re.findall(r"^## (第[一二三四五六]步)\s", text, flags=re.MULTILINE)
    if units != PROMPT_STEPS:
        errors.append(f"expected six visible Prompt steps in order, got {units}")

    unit_blocks = re.split(r"(?=^## 第[一二三四五六]步\s)", text, flags=re.MULTILINE)[1:]
    experiment_count = 0
    for unit in unit_blocks:
        unit_id = re.match(r"## (第[一二三四五六]步)", unit)
        name = unit_id.group(1) if unit_id else "unknown"
        experiments = re.split(r"(?=^### 实验 \d+：)", unit, flags=re.MULTILINE)[1:]
        experiment_count += len(experiments)
        if len(experiments) != 3:
            errors.append(f"{name} expected 3 experiments, got {len(experiments)}")
        for experiment in experiments:
            title = experiment.splitlines()[0]
            for cue in ("**手里的材料**", "**结果对照**", "**这一轮练什么**"):
                if cue not in experiment:
                    errors.append(f"{title} missing inline cue {cue}")
            if not re.search(
                r"^\*\*(?:第一次怎么问|换一种问法|可以直接使用的 Prompt)\*\*$",
                experiment,
                re.MULTILINE,
            ):
                errors.append(f"{title} missing a copyable Prompt cue")
            if "~~~text" not in experiment:
                errors.append(f"{title} missing a copyable text Prompt")

    if experiment_count != 18:
        errors.append(f"expected 18 experiments, got {experiment_count}")

    forbidden = (
        "SHA-256",
        "Request ID",
        "DASHSCOPE_API_KEY",
        "OPENAI_API_KEY",
        "讲师使用说明",
        "讲师工作坊",
        "证据边界",
        "失败分支",
    )
    for phrase in forbidden:
        if phrase in text:
            errors.append(f"forbidden classroom wording: {phrase}")

    member_path = ROOT / "dataset" / "B002-member-value-experiment" / "case.csv"
    with member_path.open(encoding="utf-8-sig", newline="") as handle:
        members = list(csv.DictReader(handle))
    segments = Counter(row["value_segment"] for row in members)
    if len(members) != 5000 or segments["成长"] != 1250:
        errors.append("member experiment source no longer matches 5000 members / 1250 growth members")
    for expected in ("5,000 人", "1,250 人", "人民币 10,000 元"):
        if expected not in text:
            errors.append(f"member experiment missing visible result: {expected}")

    agriculture_path = ROOT / "dataset" / "P-prompt-curriculum" / "agricultural-wholesale-price.csv"
    with agriculture_path.open(encoding="utf-8-sig", newline="") as handle:
        agriculture = list(csv.DictReader(handle))
    if len(agriculture) != 1104:
        errors.append(f"agriculture source expected 1104 rows, got {len(agriculture)}")
    for expected in ("2021-03", "43.38", "37.44", "-5.94", "-13.69%"):
        if expected not in text:
            errors.append(f"agriculture experiment missing visible top-change value: {expected}")

    if errors:
        return fail(errors)
    print(
        "PROMPT LABS PASSED "
        f"units={len(units)} experiments={experiment_count} "
        f"member_rows={len(members)} agriculture_rows={len(agriculture)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
