from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_ROOT))

import build_report


def write_fixture(manifest_dir: Path, receipt_dir: Path, semantic_id: str, *, receipt_status: str = "completed", improved_status: str = "passed") -> None:
    case_id = f"{semantic_id}-fixture"
    manifest = {
        "schemaVersion": "1.0",
        "caseId": case_id,
        "systemPrompt": "系统",
        "sharedContext": "共享资料",
        "baselinePrompt": f"{semantic_id} baseline",
        "improvedPrompt": f"{semantic_id} improved",
        "evaluators": [{"id": "required", "type": "requiredAny", "values": ["回答"]}],
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    manifest_path = manifest_dir / f"{semantic_id}.json"
    manifest_path.write_bytes(manifest_bytes)

    def variant(name: str, verdict: str) -> dict:
        response = {
            "id": f"request-{semantic_id}-{name}",
            "object": "chat.completion",
            "model": "qwen-test",
            "choices": [{"message": {"content": f"{semantic_id} {name} 完整回答"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        }
        text = response["choices"][0]["message"]["content"]
        return {
            "status": "completed",
            "started_at_utc": "2026-01-01T00:00:00Z",
            "completed_at_utc": "2026-01-01T00:00:01Z",
            "prompt": manifest[f"{name}Prompt"],
            "prompt_hash": hashlib.sha256(manifest[f"{name}Prompt"].encode()).hexdigest(),
            "request": {"request_hash": hashlib.sha256(f"request-{semantic_id}-{name}".encode()).hexdigest()},
            "response": {
                "text": text,
                "metadata": {"id": response["id"], "model": "qwen-test", "finish_reason": "stop"},
                "usage": response["usage"],
                "response_hash": hashlib.sha256(json.dumps(response, sort_keys=True).encode()).hexdigest(),
                "text_hash": hashlib.sha256(text.encode()).hexdigest(),
            },
            "evaluator": {
                "status": verdict,
                "checks": [{"id": "required", "type": "requiredAny", "status": verdict, "expected": ["回答"], "actual": ["回答"]}],
            },
        }

    receipt = {
        "case_id": case_id,
        "status": receipt_status,
        "created_at_utc": "2026-01-01T00:00:00Z",
        "completed_at_utc": "2026-01-01T00:00:02Z",
        "provider": {"name": "dashscope", "base_url": "https://example.invalid/v1", "model": "qwen-test"},
        "manifest": {
            "file_hash": hashlib.sha256(manifest_bytes).hexdigest(),
            "normalized_hash": "normalized-hash",
        },
        "variants": {
            "baseline": variant("baseline", "failed"),
            "improved": variant("improved", improved_status),
        },
        "Authorization": "must-not-appear",
    }
    target = receipt_dir / case_id / "receipt.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(receipt, ensure_ascii=False), encoding="utf-8")


class BuildReportTests(unittest.TestCase):
    def fixture_tree(self, root: Path):
        manifests = root / "manifests"
        receipts = root / "receipts"
        manifests.mkdir()
        receipts.mkdir()
        for semantic_id in build_report.EXPECTED_IDS:
            write_fixture(manifests, receipts, semantic_id)
        return manifests, receipts

    def test_builds_deterministic_eight_case_markdown_and_json(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests, receipts = self.fixture_tree(root)
            report = build_report.build_report(manifests, receipts)
            markdown_path = root / "report.md"
            json_path = root / "report.json"
            build_report.write_outputs(report, markdown_path, json_path)
            first_markdown = markdown_path.read_bytes()
            first_json = json_path.read_bytes()
            build_report.write_outputs(report, markdown_path, json_path)
            self.assertEqual(first_markdown, markdown_path.read_bytes())
            self.assertEqual(first_json, json_path.read_bytes())
            self.assertEqual(report["case_count"], 8)
            self.assertEqual(report["summary"]["improved_passed"], 8)
            self.assertIn("P001 baseline 完整回答", first_markdown.decode("utf-8"))
            self.assertIn("request-P001-baseline", first_markdown.decode("utf-8"))
            self.assertNotIn("SHA-256", first_markdown.decode("utf-8"))
            self.assertNotIn(b"Authorization", first_markdown)
            self.assertNotIn(b"Authorization", first_json)

    def test_missing_receipt_is_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests, receipts = self.fixture_tree(root)
            (receipts / "P008-fixture" / "receipt.json").unlink()
            with self.assertRaises(build_report.ReportError):
                build_report.build_report(manifests, receipts)

    def test_noncompleted_receipt_is_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests, receipts = self.fixture_tree(root)
            path = receipts / "P003-fixture" / "receipt.json"
            receipt = json.loads(path.read_text(encoding="utf-8"))
            receipt["status"] = "blocked"
            path.write_text(json.dumps(receipt), encoding="utf-8")
            with self.assertRaisesRegex(build_report.ReportError, "not completed"):
                build_report.build_report(manifests, receipts)

    def test_failed_improved_evaluator_is_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests, receipts = self.fixture_tree(root)
            path = receipts / "P004-fixture" / "receipt.json"
            receipt = json.loads(path.read_text(encoding="utf-8"))
            receipt["variants"]["improved"]["evaluator"]["status"] = "failed"
            path.write_text(json.dumps(receipt), encoding="utf-8")
            with self.assertRaisesRegex(build_report.ReportError, "did not pass"):
                build_report.build_report(manifests, receipts)


if __name__ == "__main__":
    unittest.main()
