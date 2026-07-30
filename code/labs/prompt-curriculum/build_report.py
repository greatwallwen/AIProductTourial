from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


COURSE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST_DIR = COURSE_ROOT / "dataset" / "P-prompt-curriculum"
DEFAULT_RECEIPT_DIR = COURSE_ROOT / "evidence" / "runtime" / "prompt-curriculum"
EXPECTED_IDS = [f"P{index:02d}" for index in range(1, 9)]
SENSITIVE_KEY_NAMES = {"authorization", "apikey", "api_key", "dashscope_api_key"}
SENSITIVE_VALUE_PATTERN = re.compile(r"(?i)\bauthorization\b|\bbearer\s+\S+|DASHSCOPE_API_KEY")


class ReportError(ValueError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_json(path: Path) -> tuple[dict[str, Any], bytes]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise ReportError(f"missing or unreadable file: {path}: {error}") from error
    try:
        value = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReportError(f"invalid UTF-8 JSON: {path}: {error}") from error
    if not isinstance(value, dict):
        raise ReportError(f"JSON root must be an object: {path}")
    return value, raw


def require_dict(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ReportError(f"{label} must be an object")
    return value


def require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ReportError(f"{label} must be a non-empty string")
    return value


def _safe_scalar(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise ReportError(f"unsupported scalar in report: {type(value).__name__}")


def _usage(value: Any, label: str) -> dict[str, Any]:
    usage = require_dict(value, label)
    return {
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "total_tokens": usage.get("total_tokens"),
    }


def _variant(
    name: str,
    manifest_prompt: str,
    receipt_variant: Any,
    *,
    case_id: str,
) -> dict[str, Any]:
    variant = require_dict(receipt_variant, f"{case_id}.{name}")
    if variant.get("status") != "completed":
        raise ReportError(f"{case_id} {name} status is not completed")
    prompt = require_text(variant.get("prompt"), f"{case_id}.{name}.prompt")
    if prompt != manifest_prompt:
        raise ReportError(f"{case_id} {name} prompt differs from manifest")
    request = require_dict(variant.get("request"), f"{case_id}.{name}.request")
    response = require_dict(variant.get("response"), f"{case_id}.{name}.response")
    metadata = require_dict(response.get("metadata"), f"{case_id}.{name}.response.metadata")
    evaluator = require_dict(variant.get("evaluator"), f"{case_id}.{name}.evaluator")
    checks = evaluator.get("checks")
    if not isinstance(checks, list) or any(not isinstance(check, dict) for check in checks):
        raise ReportError(f"{case_id}.{name}.evaluator.checks must be an object array")
    evaluator_record = {
        "status": evaluator.get("status"),
        "checks": [
            {
                "id": check.get("id"),
                "type": check.get("type"),
                "status": check.get("status"),
                "path": check.get("path"),
                "path_found": check.get("path_found"),
                "expected": check.get("expected"),
                "actual": check.get("actual"),
            }
            for check in checks
        ],
    }
    return {
        "status": variant["status"],
        "started_at_utc": variant.get("started_at_utc"),
        "completed_at_utc": variant.get("completed_at_utc"),
        "prompt": prompt,
        "prompt_hash": require_text(variant.get("prompt_hash"), f"{case_id}.{name}.prompt_hash"),
        "request_hash": require_text(request.get("request_hash"), f"{case_id}.{name}.request_hash"),
        "response_text": require_text(response.get("text"), f"{case_id}.{name}.response.text"),
        "response_hash": require_text(response.get("response_hash"), f"{case_id}.{name}.response_hash"),
        "response_text_hash": require_text(response.get("text_hash"), f"{case_id}.{name}.text_hash"),
        "request_id": require_text(metadata.get("id"), f"{case_id}.{name}.metadata.id"),
        "model": require_text(metadata.get("model"), f"{case_id}.{name}.metadata.model"),
        "finish_reason": _safe_scalar(metadata.get("finish_reason")),
        "usage": _usage(response.get("usage"), f"{case_id}.{name}.usage"),
        "evaluator": evaluator_record,
    }


def _assert_no_sensitive_material(value: Any, path: str = "report") -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key).casefold() in SENSITIVE_KEY_NAMES:
                raise ReportError(f"sensitive key rejected at {path}.{key}")
            _assert_no_sensitive_material(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _assert_no_sensitive_material(item, f"{path}[{index}]")
    elif isinstance(value, str) and SENSITIVE_VALUE_PATTERN.search(value):
        raise ReportError(f"sensitive material rejected at {path}")


def build_report(manifest_dir: Path, receipt_dir: Path) -> dict[str, Any]:
    cases: list[dict[str, Any]] = []
    for semantic_id in EXPECTED_IDS:
        manifest_path = manifest_dir / f"{semantic_id}.json"
        manifest, manifest_raw = load_json(manifest_path)
        case_id = require_text(manifest.get("caseId"), f"{semantic_id}.caseId")
        receipt_path = receipt_dir / case_id / "receipt.json"
        receipt, _ = load_json(receipt_path)
        if receipt.get("case_id") != case_id:
            raise ReportError(f"{semantic_id} receipt case_id mismatch")
        if receipt.get("status") != "completed":
            raise ReportError(f"{case_id} receipt status is not completed")
        manifest_receipt = require_dict(receipt.get("manifest"), f"{case_id}.manifest")
        actual_manifest_hash = sha256_bytes(manifest_raw)
        receipt_manifest_hash = require_text(manifest_receipt.get("file_hash"), f"{case_id}.manifest.file_hash")
        if receipt_manifest_hash != actual_manifest_hash:
            raise ReportError(f"{case_id} manifest hash does not match receipt")

        variants = require_dict(receipt.get("variants"), f"{case_id}.variants")
        baseline = _variant("baseline", require_text(manifest.get("baselinePrompt"), f"{case_id}.baselinePrompt"), variants.get("baseline"), case_id=case_id)
        improved = _variant("improved", require_text(manifest.get("improvedPrompt"), f"{case_id}.improvedPrompt"), variants.get("improved"), case_id=case_id)
        if improved["evaluator"]["status"] != "passed":
            raise ReportError(f"{case_id} improved evaluator did not pass")

        provider = require_dict(receipt.get("provider"), f"{case_id}.provider")
        cases.append({
            "semantic_id": semantic_id,
            "case_id": case_id,
            "receipt_status": receipt["status"],
            "created_at_utc": receipt.get("created_at_utc"),
            "completed_at_utc": receipt.get("completed_at_utc"),
            "provider": {
                "name": provider.get("name"),
                "base_url": provider.get("base_url"),
                "model": provider.get("model"),
            },
            "manifest": {
                "filename": manifest_path.name,
                "file_hash": actual_manifest_hash,
                "normalized_hash": manifest_receipt.get("normalized_hash"),
            },
            "baseline": baseline,
            "improved": improved,
        })

    baseline_passed = sum(case["baseline"]["evaluator"]["status"] == "passed" for case in cases)
    report = {
        "schema_version": "1.0",
        "report_type": "prompt-curriculum-ab-runtime",
        "case_count": len(cases),
        "summary": {
            "completed": len(cases),
            "baseline_passed": baseline_passed,
            "baseline_failed": len(cases) - baseline_passed,
            "improved_passed": len(cases),
            "tokens": {
                "baseline_total": sum(int(case["baseline"]["usage"].get("total_tokens") or 0) for case in cases),
                "improved_total": sum(int(case["improved"]["usage"].get("total_tokens") or 0) for case in cases),
            },
        },
        "cases": cases,
    }
    _assert_no_sensitive_material(report)
    return report


def _json_inline(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _table_cell(value: Any) -> str:
    text = _json_inline(value) if not isinstance(value, str) else value
    return text.replace("|", "\\|").replace("\r", "").replace("\n", "<br>")


def _fenced(text: str, language: str = "text") -> str:
    longest = max((len(match.group(0)) for match in re.finditer(r"`+", text)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}{language}\n{text}\n{fence}"


def _variant_markdown(title: str, variant: dict[str, Any]) -> list[str]:
    usage = variant["usage"]
    lines = [
        f"### {title} Prompt",
        "",
        _fenced(variant["prompt"]),
        "",
        f"### {title} 真实回答",
        "",
        _fenced(variant["response_text"]),
        "",
        f"### {title} 运行元数据",
        "",
        f"- 状态：`{variant['status']}`",
        f"- Request ID：`{variant['request_id']}`",
        f"- Model：`{variant['model']}`",
        f"- Tokens：prompt `{usage.get('prompt_tokens')}` / completion `{usage.get('completion_tokens')}` / total `{usage.get('total_tokens')}`",
        "",
        f"### {title} Evaluator：`{variant['evaluator']['status']}`",
        "",
        "| Check | Type | Status | Path | Expected | Actual |",
        "|---|---|---|---|---|---|",
    ]
    for check in variant["evaluator"]["checks"]:
        lines.append(
            "| " + " | ".join(_table_cell(value) for value in (
                check.get("id"), check.get("type"), check.get("status"), check.get("path"), check.get("expected"), check.get("actual")
            )) + " |"
        )
    return lines


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Prompt Curriculum A/B 真实运行报告",
        "",
        "本报告仅汇总已完成的 Provider receipts；回答、用量和评测结果均直接来自对应 receipt。机器校验字段保留在 JSON 报告中，不占用阅读版篇幅。",
        "",
        "## 八案汇总",
        "",
        f"- 完成：`{summary['completed']}/8`",
        f"- Baseline 通过：`{summary['baseline_passed']}`；未通过：`{summary['baseline_failed']}`",
        f"- Improved 通过：`{summary['improved_passed']}/8`",
        f"- 总 Tokens：baseline `{summary['tokens']['baseline_total']}`；improved `{summary['tokens']['improved_total']}`",
        "",
        "| ID | Case | Baseline | Improved | Model | Baseline tokens | Improved tokens |",
        "|---|---|---|---|---|---:|---:|",
    ]
    for case in report["cases"]:
        lines.append(
            f"| {case['semantic_id']} | {_table_cell(case['case_id'])} | {case['baseline']['evaluator']['status']} | "
            f"{case['improved']['evaluator']['status']} | {_table_cell(case['provider']['model'])} | "
            f"{case['baseline']['usage']['total_tokens']} | {case['improved']['usage']['total_tokens']} |"
        )
    for case in report["cases"]:
        lines.extend([
            "",
            f"## {case['semantic_id']} · {case['case_id']}",
            "",
            f"- Receipt：`{case['receipt_status']}`",
            f"- Provider：`{case['provider']['name']}`",
            f"- Model：`{case['provider']['model']}`",
            f"- Manifest：`{case['manifest']['filename']}`",
            "",
        ])
        lines.extend(_variant_markdown("Baseline", case["baseline"]))
        lines.append("")
        lines.extend(_variant_markdown("Improved", case["improved"]))
    markdown = "\n".join(lines).rstrip() + "\n"
    if SENSITIVE_VALUE_PATTERN.search(markdown):
        raise ReportError("sensitive material detected in rendered Markdown")
    return markdown


def write_outputs(report: dict[str, Any], markdown_output: Path, json_output: Path) -> None:
    if markdown_output.resolve() == json_output.resolve():
        raise ReportError("markdown-output and json-output must differ")
    markdown = render_markdown(report)
    json_text = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if SENSITIVE_VALUE_PATTERN.search(json_text):
        raise ReportError("sensitive material detected in rendered JSON")
    markdown_output.parent.mkdir(parents=True, exist_ok=True)
    json_output.parent.mkdir(parents=True, exist_ok=True)
    markdown_output.write_text(markdown, encoding="utf-8")
    json_output.write_text(json_text, encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a deterministic report from P01-P08 Prompt A/B receipts")
    parser.add_argument("--manifest-dir", type=Path, default=DEFAULT_MANIFEST_DIR)
    parser.add_argument("--receipt-dir", type=Path, default=DEFAULT_RECEIPT_DIR)
    parser.add_argument("--markdown-output", type=Path, required=True)
    parser.add_argument("--json-output", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = build_report(args.manifest_dir, args.receipt_dir)
        write_outputs(report, args.markdown_output, args.json_output)
    except (OSError, ReportError) as error:
        print(f"REPORT BLOCKED: {error}", file=sys.stderr)
        return 2
    print(json.dumps({
        "status": "completed",
        "cases": report["case_count"],
        "markdown": str(args.markdown_output),
        "json": str(args.json_output),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
