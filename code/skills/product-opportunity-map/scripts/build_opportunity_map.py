from __future__ import annotations

import argparse
import csv
import hashlib
import json
import textwrap
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


ENCODINGS = ("utf-8-sig", "utf-8", "gb18030")
REQUIRED_HEADERS = {"lab_id", "step_id", "stage", "title", "detail", "status", "artifact"}
DEFAULT_RULES = Path(__file__).resolve().parents[1] / "contracts" / "business-rules.json"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _read_csv(path: Path) -> tuple[str, list[str], list[dict[str, str]]]:
    last_error: UnicodeDecodeError | None = None
    for encoding in ENCODINGS:
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                reader = csv.DictReader(handle)
                headers = list(reader.fieldnames or [])
                rows = []
                for row_number, row in enumerate(reader, start=2):
                    normalized = {key: str(value or "") for key, value in row.items() if key is not None}
                    normalized["_row_number"] = str(row_number)
                    rows.append(normalized)
            return encoding, headers, rows
        except UnicodeDecodeError as error:
            last_error = error
    raise ValueError(f"unsupported_encoding:{last_error}")


def _load_rules(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8-sig") as handle:
        rules = json.load(handle)
    if not isinstance(rules, dict):
        raise ValueError("rules_must_be_object")
    return rules


def _source_ref(row: dict[str, str], field: str) -> dict[str, Any]:
    return {
        "row_number": int(row["_row_number"]),
        "lab_id": row["lab_id"],
        "step_id": row["step_id"],
        "field": field,
        "value": row[field],
    }


def _find_step(rows: list[dict[str, str]], step_id: str) -> dict[str, str]:
    matches = [row for row in rows if row["step_id"] == step_id]
    if len(matches) != 1:
        raise ValueError(f"expected_one_s04_step:{step_id}")
    return matches[0]


def build_map(
    input_path: str | Path,
    allowed_root: str | Path,
    rules_path: str | Path = DEFAULT_RULES,
) -> dict[str, Any]:
    root = Path(allowed_root).resolve()
    path = Path(input_path).resolve()
    if not _inside(path, root):
        raise ValueError("input_outside_allowed_root")
    if path.suffix.lower() != ".csv":
        raise ValueError("input_must_be_csv")
    if not path.is_file():
        raise ValueError("input_missing")

    encoding, headers, all_rows = _read_csv(path)
    missing_headers = sorted(REQUIRED_HEADERS - set(headers))
    if missing_headers:
        raise ValueError("missing_headers:" + ",".join(missing_headers))

    rules_document = _load_rules(rules_path)
    filter_values = rules_document.get("dataset_filter", {})
    rows = [
        row for row in all_rows
        if all(row.get(field) == str(value) for field, value in filter_values.items())
    ]
    if not rows:
        raise ValueError("no_rows_match_dataset_filter")

    rules = {rule["id"]: rule for rule in rules_document.get("rules", [])}
    evidence_rule = rules["evidence-from-observation"]
    opportunity_rule = rules["split-action-opportunities"]
    experiment_rule = rules["experiment-from-check"]
    evidence_row = _find_step(rows, str(evidence_rule["step_id"]))
    action_row = _find_step(rows, str(opportunity_rule["step_id"]))
    experiment_row = _find_step(rows, str(experiment_rule["step_id"]))

    action_text = action_row[str(opportunity_rule["field"])]
    required_phrases = [str(value) for value in opportunity_rule["required_phrases"]]
    if any(phrase not in action_text for phrase in required_phrases):
        raise ValueError("action_detail_missing_required_phrase")

    evidence_ref = _source_ref(evidence_row, str(evidence_rule["field"]))
    action_ref = _source_ref(action_row, str(opportunity_rule["field"]))
    experiment_ref = _source_ref(experiment_row, str(experiment_rule["field"]))
    opportunity_labels = [str(value) for value in opportunity_rule["opportunity_labels"]]
    if len(opportunity_labels) != 2:
        raise ValueError("expected_two_opportunity_labels")

    nodes = [
        {
            "id": "goal",
            "kind": "goal",
            "label": str(rules["goal-label"]["label"]),
            "rule_id": "goal-label",
            "source_refs": [action_ref],
        },
        {
            "id": "problem-evidence",
            "kind": "evidence",
            "label": evidence_ref["value"],
            "rule_id": "evidence-from-observation",
            "source_refs": [evidence_ref],
        },
        {
            "id": "opportunity-order-link",
            "kind": "opportunity",
            "label": opportunity_labels[0],
            "rule_id": "split-action-opportunities",
            "source_refs": [action_ref],
        },
        {
            "id": "opportunity-approval-wait",
            "kind": "opportunity",
            "label": opportunity_labels[1],
            "rule_id": "split-action-opportunities",
            "source_refs": [action_ref],
        },
        {
            "id": "first-experiment",
            "kind": "experiment",
            "label": experiment_ref["value"],
            "rule_id": "experiment-from-check",
            "source_refs": [experiment_ref],
        },
    ]
    edges = [
        {"from": "goal", "to": "problem-evidence", "relation": "framed_by"},
        {"from": "problem-evidence", "to": "opportunity-order-link", "relation": "supports"},
        {"from": "problem-evidence", "to": "opportunity-approval-wait", "relation": "supports"},
        {"from": "opportunity-order-link", "to": "first-experiment", "relation": "tested_by"},
        {"from": "opportunity-approval-wait", "to": "first-experiment", "relation": "not_yet_tested"},
    ]

    source_records = []
    for row in rows:
        source_records.append({
            "row_number": int(row["_row_number"]),
            **{header: row[header] for header in headers},
        })

    return {
        "schema_version": 1,
        "status": "complete",
        "source": {
            "path": str(path),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "encoding": encoding,
            "filter": filter_values,
            "row_count": len(rows),
            "fields": headers,
        },
        "business_rules": list(rules_document.get("rules", [])),
        "source_records": source_records,
        "nodes": nodes,
        "edges": edges,
    }


def _svg_tag(name: str) -> str:
    return f"{{{SVG_NS}}}{name}"


def _wrapped_lines(text: str, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines() or [text]:
        chunks = textwrap.wrap(paragraph, width=width, break_long_words=True, break_on_hyphens=False)
        lines.extend(chunks or [""])
    return lines


def render_svg(document: dict[str, Any]) -> str:
    root = ET.Element(_svg_tag("svg"), {
        "viewBox": "0 0 1200 760",
        "width": "1200",
        "height": "760",
        "role": "img",
        "aria-labelledby": "map-title map-desc",
    })
    ET.SubElement(root, _svg_tag("title"), {"id": "map-title"}).text = "门店差评处理产品机会图"
    ET.SubElement(root, _svg_tag("desc"), {"id": "map-desc"}).text = "由 CSV 证据和显式业务规则生成的可编辑机会图。"
    style = ET.SubElement(root, _svg_tag("style"))
    style.text = (
        ".label{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif;fill:#172033;}"
        ".node-title{font-size:19px;font-weight:700;}"
        ".meta{font-size:12px;fill:#5c667a;}"
        ".edge{stroke:#778399;stroke-width:2;fill:none;marker-end:url(#arrow);}"
    )
    defs = ET.SubElement(root, _svg_tag("defs"))
    marker = ET.SubElement(defs, _svg_tag("marker"), {
        "id": "arrow", "viewBox": "0 0 10 10", "refX": "9", "refY": "5",
        "markerWidth": "7", "markerHeight": "7", "orient": "auto-start-reverse",
    })
    ET.SubElement(marker, _svg_tag("path"), {"d": "M 0 0 L 10 5 L 0 10 z", "fill": "#778399"})
    ET.SubElement(root, _svg_tag("rect"), {"width": "1200", "height": "760", "fill": "#f6f8fb"})

    positions = {
        "goal": (400, 44, 400, 92),
        "problem-evidence": (70, 190, 470, 150),
        "opportunity-order-link": (620, 190, 230, 126),
        "opportunity-approval-wait": (900, 190, 230, 126),
        "first-experiment": (360, 470, 480, 150),
    }
    centers = {node_id: (x + w / 2, y + h / 2) for node_id, (x, y, w, h) in positions.items()}
    for edge in document["edges"]:
        start = centers[edge["from"]]
        end = centers[edge["to"]]
        ET.SubElement(root, _svg_tag("path"), {
            "class": "edge",
            "data-relation": edge["relation"],
            "d": f"M {start[0]:.0f} {start[1]:.0f} L {end[0]:.0f} {end[1]:.0f}",
        })

    palette = {
        "goal": ("#dbeafe", "#2563eb"),
        "evidence": ("#fff7ed", "#ea580c"),
        "opportunity": ("#ecfdf5", "#059669"),
        "experiment": ("#f5f3ff", "#7c3aed"),
    }
    kind_names = {"goal": "目标", "evidence": "问题证据", "opportunity": "机会", "experiment": "首个验证"}
    for node in document["nodes"]:
        x, y, width, height = positions[node["id"]]
        fill, stroke = palette[node["kind"]]
        source_rows = ",".join(str(ref["row_number"]) for ref in node["source_refs"])
        group = ET.SubElement(root, _svg_tag("g"), {
            "id": f"node-{node['id']}",
            "data-kind": node["kind"],
            "data-rule-id": node["rule_id"],
            "data-source-row": source_rows,
        })
        ET.SubElement(group, _svg_tag("rect"), {
            "x": str(x), "y": str(y), "width": str(width), "height": str(height),
            "rx": "18", "fill": fill, "stroke": stroke, "stroke-width": "2",
        })
        ET.SubElement(group, _svg_tag("text"), {
            "class": "label meta", "x": str(x + 22), "y": str(y + 27),
        }).text = kind_names[node["kind"]]
        text_element = ET.SubElement(group, _svg_tag("text"), {
            "class": "label node-title", "text-anchor": "middle", "x": str(x + width / 2), "y": str(y + 54),
        })
        wrap_width = 16 if width < 300 else 27
        for index, line in enumerate(_wrapped_lines(node["label"], wrap_width)[:4]):
            tspan = ET.SubElement(text_element, _svg_tag("tspan"), {
                "x": str(x + width / 2), "dy": "0" if index == 0 else "27",
            })
            tspan.text = line
        ref = node["source_refs"][0]
        ET.SubElement(group, _svg_tag("text"), {
            "class": "label meta", "x": str(x + 22), "y": str(y + height - 16),
        }).text = f"CSV 第{ref['row_number']}行 · {ref['field']} · {node['rule_id']}"

    footer = ET.SubElement(root, _svg_tag("g"), {"id": "source-footer"})
    source_path = Path(document["source"]["path"])
    source_label = f"dataset/{source_path.parent.name}/{source_path.name}"
    ET.SubElement(footer, _svg_tag("text"), {"class": "label meta", "x": "70", "y": "700"}).text = (
        f"来源：{source_label}"
    )
    ET.SubElement(footer, _svg_tag("text"), {"class": "label meta", "x": "70", "y": "722"}).text = (
        f"筛选：lab_id=S004 · 样本：{document['source']['row_count']} 条 · 图中节点可编辑"
    )
    return ET.tostring(root, encoding="unicode", xml_declaration=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a traceable Chinese SVG product opportunity map.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--rules", default=str(DEFAULT_RULES))
    parser.add_argument("--json-output", required=True)
    parser.add_argument("--svg-output", required=True)
    args = parser.parse_args()
    try:
        document = build_map(args.input, args.allowed_root, args.rules)
        svg = render_svg(document)
        json_output = Path(args.json_output)
        svg_output = Path(args.svg_output)
        json_output.parent.mkdir(parents=True, exist_ok=True)
        svg_output.parent.mkdir(parents=True, exist_ok=True)
        json_output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        svg_output.write_text(svg, encoding="utf-8")
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    summary = {
        "status": document["status"],
        "source_rows": document["source"]["row_count"],
        "nodes": len(document["nodes"]),
        "edges": len(document["edges"]),
        "json_output": str(json_output.resolve()),
        "svg_output": str(svg_output.resolve()),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
