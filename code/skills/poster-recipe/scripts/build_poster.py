from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = ("theme", "audience", "headline")


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _text(value: object) -> str:
    return str(value or "").strip()


def _list(value: object) -> list[str]:
    if isinstance(value, list):
        return [_text(item) for item in value if _text(item)]
    return [_text(value)] if _text(value) else []


def load_brief(input_path: str | Path, allowed_root: str | Path) -> tuple[Path, dict[str, Any], str]:
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


def build_recipes(brief: dict[str, Any], source_path: Path, source_digest: str) -> dict[str, Any]:
    headline = _text(brief["headline"])
    audience = _text(brief["audience"])
    theme = _text(brief["theme"])
    support = _list(brief.get("supporting_copy"))
    visible_subjects = _list(brief.get("visible_subjects"))
    forbidden = _list(brief.get("forbidden"))
    required_copy = _list(brief.get("required_copy"))
    gaps = _list(brief.get("material_gaps"))
    if not visible_subjects:
        gaps.append("未提供可见主体，本地 SVG 仅能使用抽象几何元素。")

    shared = {
        "audience": audience,
        "headline": headline,
        "required_copy": required_copy,
        "forbidden": forbidden,
        "material_gaps": gaps,
    }
    recipes = [
        {
            "id": "quiet-window",
            "name": "雨夜橱窗",
            **shared,
            "concept": f"用大量留白和一扇暖黄橱窗呈现“{theme}”。",
            "information_hierarchy": [headline, *support[:2], *required_copy[:1]],
            "palette": ["#F4F0E6", "#172A3A", "#F4B942", "#657786"],
            "fonts": {
                "headline": "Noto Serif CJK SC / Source Han Serif SC",
                "body": "Noto Sans CJK SC / Microsoft YaHei",
            },
            "layout": {
                "system": "editorial-asymmetry",
                "density": "low",
                "headline_zone": "upper-left 58%",
                "subject_zone": "lower-right 34%",
                "anchor": "warm bookstore window",
            },
            "provider_prompt": f"编辑式中文海报，主题{theme}，雨夜旧书店橱窗，大量米白留白，深蓝雨线，一个高饱和暖黄色锚点，纸张颗粒，中文标题区清晰可读。",
            "selection_score": 94,
        },
        {
            "id": "rain-type",
            "name": "字成雨幕",
            **shared,
            "concept": f"让“{headline}”成为画面主体，用纵向字形节奏模拟雨幕。",
            "information_hierarchy": [headline, *required_copy[:1], *support[:1]],
            "palette": ["#DDE9EF", "#0D2A3A", "#16A6B6", "#F2C14E"],
            "fonts": {
                "headline": "Noto Sans CJK SC Black / Microsoft YaHei Bold",
                "body": "Noto Sans CJK SC / Microsoft YaHei",
            },
            "layout": {
                "system": "type-dominant-grid",
                "density": "medium",
                "headline_zone": "center 72%",
                "subject_zone": "bottom strip 18%",
                "anchor": "cyan vertical rain typography",
            },
            "provider_prompt": f"字体主导的中文海报，“{headline}”巨大排版形成雨幕，冷青蓝网格，底部仅保留旧书与灯光剪影，一点暖黄，丝网印刷质感。",
            "selection_score": 86,
        },
        {
            "id": "shelter-cut",
            "name": "避雨入口",
            **shared,
            "concept": "用深色大块面与窄而明亮的门洞形成“外部喧闹 / 内部安静”对比。",
            "information_hierarchy": [headline, *support[-1:], *required_copy[:1]],
            "palette": ["#101A2B", "#F7E8C6", "#E9A23B", "#8DA9C4"],
            "fonts": {
                "headline": "Source Han Serif SC Heavy / SimSun",
                "body": "Noto Sans CJK SC / Microsoft YaHei",
            },
            "layout": {
                "system": "cinematic-split",
                "density": "low",
                "headline_zone": "left 42%",
                "subject_zone": "right doorway 46%",
                "anchor": "amber doorway cut-out",
            },
            "provider_prompt": f"电影感中文海报，深蓝雨夜占画面大部分，右侧暖黄书店门洞，一个小人物走向光源，小标题沿边缘垂直排列，木刻和凸版质感。",
            "selection_score": 89,
        },
    ]
    selected = max(recipes, key=lambda recipe: recipe["selection_score"])
    selected["selection_reason"] = (
        "标题与橱窗分区最清楚，小尺寸仍可读；冷雨与暖光的单一色锚直接对应“下班后慢下来”，"
        "且可用本地矢量元素完整表达，无需伪造图像 Provider 回执。"
    )
    return {
        "schema_version": "1.0",
        "status": "complete-local",
        "source": {
            "path": str(source_path),
            "sha256": source_digest,
            "read_mode": "read-only",
            "source_write_performed": False,
        },
        "brief": {
            "theme": theme,
            "audience": audience,
            "headline": headline,
            "supporting_copy": support,
            "visible_subjects": visible_subjects,
        },
        "recipes": recipes,
        "selected_recipe_id": selected["id"],
        "selection_reason": selected["selection_reason"],
        "image_provider_called": False,
        "image_provider_receipt": None,
        "render": {
            "kind": "editable-svg",
            "raster_images_embedded": 0,
        },
    }


def render_svg(result: dict[str, Any], brief: dict[str, Any]) -> str:
    selected = next(
        recipe for recipe in result["recipes"] if recipe["id"] == result["selected_recipe_id"]
    )
    canvas = brief.get("canvas") if isinstance(brief.get("canvas"), dict) else {}
    width = int(canvas.get("width", 1080))
    height = int(canvas.get("height", 1440))
    headline_raw = selected["headline"]
    if "，" in headline_raw:
        first, second = headline_raw.split("，", 1)
        headline_lines = [first + "，", second]
    else:
        split_at = max(1, len(headline_raw) // 2)
        headline_lines = [headline_raw[:split_at], headline_raw[split_at:]]
    headline = html.escape(headline_raw)
    headline_first = html.escape(headline_lines[0])
    headline_second = html.escape(headline_lines[1])
    support = result["brief"]["supporting_copy"]
    support_text = html.escape(support[0] if support else "给忙碌的一天，留一页安静。")
    audience = html.escape(selected["audience"])
    required = html.escape(" · ".join(selected["required_copy"][:2]))
    palette = selected["palette"]
    rain_lines = "\n".join(
        f'<line x1="{x}" y1="{y}" x2="{x - 18}" y2="{y + 54}" />'
        for x, y in ((650, 130), (735, 210), (820, 105), (905, 285), (990, 175), (710, 430), (870, 510))
    )
    books = "\n".join(
        f'<rect x="{662 + index * 38}" y="{1110 - (index % 3) * 18}" width="28" height="{128 + (index % 3) * 18}" rx="2" fill="{palette[(index % 2) + 1]}" />'
        for index in range(7)
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 1080 1440" role="img" aria-labelledby="poster-title poster-desc" data-editable="true">
  <title id="poster-title">{headline}</title>
  <desc id="poster-desc">本地确定性矢量海报，没有调用图像 Provider。</desc>
  <rect id="paper" width="1080" height="1440" fill="{palette[0]}" />
  <g id="rain" stroke="{palette[1]}" stroke-width="5" stroke-linecap="round" opacity="0.38">
    {rain_lines}
  </g>
  <g id="headline-block" font-family="Noto Serif CJK SC, Source Han Serif SC, SimSun, serif" fill="{palette[1]}">
    <text x="92" y="178" font-size="34" letter-spacing="5">EDITORIAL  /  RAIN  /  BOOKS</text>
    <text font-size="98" font-weight="700">
      <tspan x="84" y="338">{headline_first}</tspan>
      <tspan x="84" y="458">{headline_second}</tspan>
    </text>
    <line x1="88" y1="510" x2="510" y2="510" stroke="{palette[2]}" stroke-width="14" />
  </g>
  <g id="information" font-family="Noto Sans CJK SC, Microsoft YaHei, sans-serif" fill="{palette[1]}">
    <text x="92" y="610" font-size="36">{support_text}</text>
    <text x="92" y="668" font-size="24" opacity="0.72">受众｜{audience}</text>
    <text x="92" y="1310" font-size="24" letter-spacing="2">{required}</text>
  </g>
  <g id="bookstore-window" data-material="editable-vector">
    <rect x="620" y="760" width="364" height="500" rx="10" fill="{palette[1]}" />
    <rect x="650" y="790" width="304" height="410" fill="{palette[2]}" />
    <rect x="674" y="820" width="256" height="250" fill="#FFF6DD" opacity="0.94" />
    <line x1="802" y1="820" x2="802" y2="1070" stroke="{palette[1]}" stroke-width="10" />
    <line x1="674" y1="952" x2="930" y2="952" stroke="{palette[1]}" stroke-width="10" />
    <circle cx="802" cy="900" r="58" fill="#FFE38A" opacity="0.72" />
    <path d="M755 1180 Q802 1125 849 1180" fill="none" stroke="#FFF6DD" stroke-width="12" />
    {books}
  </g>
  <g id="footer" font-family="Noto Sans CJK SC, Microsoft YaHei, sans-serif" fill="{palette[1]}">
    <text x="92" y="1380" font-size="18" opacity="0.62">LOCAL EDITABLE SVG · NO IMAGE PROVIDER RECEIPT</text>
  </g>
</svg>
'''


def _write(path_value: str, content: str, input_path: Path) -> Path:
    target = Path(path_value).resolve()
    if target == input_path:
        raise ValueError("output_must_not_overwrite_input")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Build three poster recipes and an editable SVG.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--recipe-output", required=True)
    parser.add_argument("--svg-output", required=True)
    args = parser.parse_args()
    try:
        source_path, brief, digest = load_brief(args.input, args.allowed_root)
        result = build_recipes(brief, source_path, digest)
        recipe_path = _write(
            args.recipe_output,
            json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            source_path,
        )
        svg_path = _write(args.svg_output, render_svg(result, brief), source_path)
    except (OSError, TypeError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(
        json.dumps(
            {
                "status": "complete-local",
                "recipes": len(result["recipes"]),
                "selected_recipe_id": result["selected_recipe_id"],
                "recipe_output": str(recipe_path),
                "svg_output": str(svg_path),
                "image_provider_called": False,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
