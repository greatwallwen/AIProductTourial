from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = ("theme", "audience", "headline")
GROUP_FILENAMES = {
    "A": "A-ordinary.txt",
    "B": "B-structured.txt",
    "C": "C-style-library.txt",
    "D": "D-memory-translator.txt",
}


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _text(value: object) -> str:
    return str(value or "").strip()


def _items(value: object) -> list[str]:
    if isinstance(value, list):
        return [_text(item) for item in value if _text(item)]
    return [_text(value)] if _text(value) else []


def _quoted(items: list[str]) -> str:
    return "、".join(f'“{item}”' for item in items)


def _load_brief(input_path: str | Path, allowed_root: str | Path) -> tuple[Path, dict[str, Any], str]:
    root = Path(allowed_root).resolve()
    path = Path(input_path).resolve()
    if not root.is_dir():
        raise ValueError("allowed_root_missing")
    if not _inside(path, root):
        raise ValueError("input_outside_allowed_root")
    if path.suffix.lower() != ".json":
        raise ValueError("input_must_be_json")
    if not path.is_file():
        raise ValueError("input_missing")
    raw = path.read_bytes()
    try:
        brief = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid_brief_json:{error}") from error
    if not isinstance(brief, dict):
        raise ValueError("brief_must_be_object")
    missing = [field for field in REQUIRED_FIELDS if not _text(brief.get(field))]
    if missing:
        raise ValueError("missing_required_fields:" + ",".join(missing))
    return path, brief, hashlib.sha256(raw).hexdigest()


def _build_groups(brief: dict[str, Any]) -> list[dict[str, Any]]:
    theme = _text(brief["theme"])
    audience = _text(brief["audience"])
    headline = _text(brief["headline"])
    supporting = _items(brief.get("supporting_copy"))
    required = _items(brief.get("required_copy"))
    subjects = _items(brief.get("visible_subjects"))
    forbidden = _items(brief.get("forbidden"))

    ordinary = f"为“{theme}”设计一张竖版活动海报，标题是“{headline}”。"

    structured = f"""Use case: ads-marketing
Asset type: 3:4 竖版活动海报
Primary request: 为“{theme}”设计一张可直接发布的活动海报
Audience: {audience}
Scene/backdrop: 深蓝雨夜中的旧书店，画面安静、克制，不做热闹促销氛围
Subject: {_quoted(subjects)}
Composition/framing: 3:4 竖构图；标题、活动信息、品牌文字形成清楚的三级层级；保留足够留白
Lighting/mood: 冷雨与单一暖黄灯光对比，表达下班后慢下来的情绪
Color palette: 米白、深蓝、暖黄与低饱和灰；不使用多色渐变
Text (verbatim): 主标题“{headline}”；辅助文字{_quoted(supporting)}；必备文字{_quoted(required)}
Constraints: 所有指定文字逐字准确、各出现一次；雨线、暖黄橱窗、旧书脊和一盏灯必须可见；小尺寸仍可读；只输出一张完成海报
Avoid: {_quoted(forbidden)}、乱码、随机英文、额外活动信息、Logo、水印、拼贴过程板"""

    style_library = f"""Selected template: Poster Layout System / 海报排版系统
Template ID: poster-layout-system
Example cases: case 345, case 5, case 10

Subject and task: 为“{theme}”生成一张完成度高的活动海报，面向{audience}。
Composition and layout: 3:4 竖版；采用编辑式不对称布局。标题位于上部主要阅读区，暖黄橱窗作为唯一视觉锚点，旧书脊集中在下部，细雨线连接上下空间。标题、活动信息、品牌文字形成清楚的三级层级，至少保留约 30% 安静留白。不要输出 moodboard、宫格或设计过程。
Visual style and materials: 当代编辑海报、克制的纸张颗粒、米白与深蓝为主色，只用一个暖黄色锚点；冷雨和暖光形成清晰对比。字体气质为现代宋体标题配中性无衬线正文。
Text and labels (verbatim): “{headline}”；{_quoted(supporting)}；{_quoted(required)}。每段只出现一次，不得改写、漏字或增加随机文字。
Aspect ratio and output: 3:4 竖版单张完成海报。
Required subjects: {_quoted(subjects)}。
Constraints and negative details: 禁止{_quoted(forbidden)}；禁止拼贴展示板、无关装饰符号、乱码、随机英文、Logo 和水印；保证标题层级和主视觉在手机缩略图中仍可辨认。"""

    memory_translator = f"""Skill preset: editorial_text_card
Input mode: text
Preview mode: skip
Original display mode: translation_only
Layout mode: large_whitespace_small_art
Style mode: editorial_metaphor_card
Ratio: 3:4

将“{headline}”转译为一张 3:4 竖版编辑隐喻海报，同时保留活动信息功能。面向{audience}，整体像独立艺术出版页，不像商业促销模板。

只使用一个视觉隐喻：一张打开的旧书页像窄屋檐承接三条雨线，书页下方一个小型暖黄矩形代表旧书店橱窗灯光，旁边只保留少量旧书脊线条和一盏灯的轮廓。视觉隐喻占画面 15%–30%，其余为暖米白艺术纸留白。配色限定为深灰、米白、深蓝和一个暖黄强调色，无渐变。

Text (verbatim): 主标题“{headline}”；辅助文字{_quoted(supporting)}；必备文字{_quoted(required)}。保留原句，不改写成鸡汤；所有文字逐字准确、各出现一次，文字总面积保持克制但活动时间必须可读。

避免完整雨夜场景、雨窗照片、人物情节、PPT 图标墙、毛玻璃卡片、手账贴纸、人物大特写、高饱和多色渐变、密集商业促销标签、随机英文、Logo、水印和额外文字。只输出一张完成海报。"""

    return [
        {
            "id": "A",
            "label": "普通 Prompt",
            "method": "ordinary-prompt",
            "prompt": ordinary,
            "prompt_coverage": {"covered": 2, "total": 7},
            "task_fit": "baseline",
        },
        {
            "id": "B",
            "label": "人工结构化 Prompt",
            "method": "structured-prompt",
            "prompt": structured,
            "prompt_coverage": {"covered": 7, "total": 7},
            "task_fit": "full",
        },
        {
            "id": "C",
            "label": "模板 Skill",
            "method": "skill-guided-prompt",
            "skill_source": "skills/gpt-image-2-style-library/SKILL.md",
            "template_id": "poster-layout-system",
            "prompt": style_library,
            "prompt_coverage": {"covered": 7, "total": 7},
            "task_fit": "full",
        },
        {
            "id": "D",
            "label": "强风格 Skill",
            "method": "skill-guided-prompt",
            "skill_source": "skills/visual-memory-translator/SKILL.md",
            "preset": "editorial_text_card",
            "prompt": memory_translator,
            "prompt_coverage": {"covered": 7, "total": 7},
            "task_fit": "partial",
            "task_fit_note": "原 Skill 面向编辑隐喻卡，不以活动信息承载为首要目标。",
        },
    ]


def build_comparison(input_path: str | Path, allowed_root: str | Path) -> dict[str, Any]:
    path, brief, digest = _load_brief(input_path, allowed_root)
    return {
        "schema_version": "1.0",
        "experiment_id": "S05-prompt-skill-comparison",
        "source": {"path": str(path), "sha256": digest, "read_mode": "read-only"},
        "controls": {
            "same_brief": True,
            "same_provider_required": True,
            "same_model_required": True,
            "same_size_required": True,
            "same_output_count_required": True,
        },
        "groups": _build_groups(brief),
        "prompt_assessment": {
            "status": "complete",
            "basis": "可观察的简报字段覆盖与任务适配，不代表图片质量。",
        },
        "provider_execution": {
            "status": "not-run",
            "provider": None,
            "model": None,
            "request_ids": [],
            "reason": "生成器只编译 Prompt；真实图片必须由同一 Provider 另行执行并保存回执。",
        },
        "output_evaluation": {
            "status": "not-available",
            "reason": "没有真实图片和 Provider 回执，禁止填写图片质量分数。",
        },
        "claims": {"prompts_compiled": True, "images_generated": False},
    }


def _render_markdown(result: dict[str, Any]) -> str:
    lines = [
        "# S05 图像 Prompt 与 Skill 对比",
        "",
        "> 当前完成的是 Prompt 编译与结构检查。没有真实 Provider 回执，因此没有图片输出评分。",
        "",
        "## 对比摘要",
        "",
        "| 组 | 方法 | 字段覆盖 | 任务适配 |",
        "|---|---|---:|---|",
    ]
    for group in result["groups"]:
        coverage = group["prompt_coverage"]
        lines.append(
            f'| {group["id"]} | {group["label"]} | {coverage["covered"]}/{coverage["total"]} | {group["task_fit"]} |'
        )
    lines.extend(["", "## 完整 Prompt", ""])
    for group in result["groups"]:
        lines.extend(
            [
                f'### {group["id"]}：{group["label"]}',
                "",
                "```text",
                group["prompt"],
                "```",
                "",
            ]
        )
    lines.extend(
        [
            "## 当前结论边界",
            "",
            "- A 组只覆盖主题和标题，无法约束受众、必备文字、主体、禁用项和比例。",
            "- B/C/D 覆盖完整简报，但 C 增加的是模板检索与版式规则，D 增加的是强审美偏好。",
            "- D 与活动海报的任务适配仅为 partial；风格更鲜明不等于业务交付更合适。",
            "- 没有真实图片时，不能声称任何组在文字准确、构图或视觉质量上胜出。",
            "",
        ]
    )
    return "\n".join(lines)


def _write_outputs(result: dict[str, Any], output_dir: str | Path) -> None:
    root = Path(output_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    (root / "prompt-comparison.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (root / "prompt-comparison.md").write_text(_render_markdown(result), encoding="utf-8")
    prompt_dir = root / "prompts"
    prompt_dir.mkdir(exist_ok=True)
    for group in result["groups"]:
        (prompt_dir / GROUP_FILENAMES[group["id"]]).write_text(group["prompt"] + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile a four-group image Prompt comparison.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    try:
        result = build_comparison(args.input, args.allowed_root)
        _write_outputs(result, args.output_dir)
    except (OSError, TypeError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(
        json.dumps(
            {
                "status": "complete-prompt-only",
                "groups": len(result["groups"]),
                "images_generated": result["claims"]["images_generated"],
                "output_dir": str(Path(args.output_dir).resolve()),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
