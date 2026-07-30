from __future__ import annotations

import json
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path


MODULE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_ROOT))

import run_experiment as runtime


def manifest() -> dict:
    return {
        "schemaVersion": "1.0",
        "caseId": "test-case",
        "systemPrompt": "你是测试助手",
        "sharedContext": "共享背景",
        "baselinePrompt": "简单回答",
        "improvedPrompt": "回答时包含预算并说明停止条件",
        "model": "qwen-test",
        "temperature": 0,
        "maxTokens": 600,
        "evaluators": [
            {"id": "budget", "type": "requiredAny", "values": ["预算"]},
            {"id": "no-guarantee", "type": "forbidden", "values": ["保证"]},
        ],
    }


class FakeResponse:
    def __init__(self, data: dict, status: int = 200) -> None:
        self.data = data
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self) -> bytes:
        return json.dumps(self.data, ensure_ascii=False).encode("utf-8")


def fake_success(request, timeout):
    assert request.get_header("Authorization") == "Bearer top-secret-key"
    body = json.loads(request.data.decode("utf-8"))
    return FakeResponse({
        "id": "response-1",
        "object": "chat.completion",
        "created": 1,
        "model": body["model"],
        "choices": [{"message": {"role": "assistant", "content": "预算明确，条件不足时停止。"}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18},
    })


class PromptExperimentTests(unittest.TestCase):
    def normalized(self):
        return runtime.validate_manifest(manifest())

    def test_offline_validates_contract_without_generating_answers(self):
        normalized, checks = self.normalized()
        receipt, exit_code = runtime.run_experiment(
            normalized,
            manifest_file_hash="file-hash",
            contract_checks=checks,
            provider="offline",
        )
        self.assertEqual(exit_code, 0)
        self.assertEqual(receipt["status"], "not-run")
        self.assertEqual(receipt["contract_evaluation"]["status"], "passed")
        for variant in receipt["variants"].values():
            self.assertEqual(variant["status"], "not-run")
            self.assertIsNone(variant["response"])
            self.assertEqual(variant["evaluator"]["status"], "not-run")

    def test_api_key_is_used_but_never_persisted(self):
        normalized, checks = self.normalized()
        receipt, exit_code = runtime.run_experiment(
            normalized,
            manifest_file_hash="file-hash",
            contract_checks=checks,
            provider="dashscope",
            api_key="top-secret-key",
            opener=fake_success,
        )
        self.assertEqual(exit_code, 0)
        self.assertEqual(receipt["status"], "completed")
        serialized = json.dumps(receipt, ensure_ascii=False)
        self.assertNotIn("top-secret-key", serialized)
        self.assertNotIn("Authorization", serialized)
        self.assertEqual(receipt["variants"]["baseline"]["response"]["usage"]["total_tokens"], 18)

    def test_request_and_response_hashes_are_stable(self):
        normalized, checks = self.normalized()
        first, _ = runtime.run_experiment(
            normalized,
            manifest_file_hash="file-hash",
            contract_checks=checks,
            provider="dashscope",
            api_key="top-secret-key",
            opener=fake_success,
        )
        second, _ = runtime.run_experiment(
            normalized,
            manifest_file_hash="file-hash",
            contract_checks=checks,
            provider="dashscope",
            api_key="top-secret-key",
            opener=fake_success,
        )
        for name in ("baseline", "improved"):
            self.assertEqual(first["variants"][name]["request"]["request_hash"], second["variants"][name]["request"]["request_hash"])
            self.assertEqual(first["variants"][name]["response"]["response_hash"], second["variants"][name]["response"]["response_hash"])

    def test_network_error_writes_blocked_receipt_and_nonzero_exit(self):
        normalized, checks = self.normalized()

        def fail(request, timeout):
            raise urllib.error.URLError("network unavailable")

        receipt, exit_code = runtime.run_experiment(
            normalized,
            manifest_file_hash="file-hash",
            contract_checks=checks,
            provider="dashscope",
            api_key="top-secret-key",
            opener=fail,
        )
        self.assertNotEqual(exit_code, 0)
        self.assertEqual(receipt["status"], "blocked")
        self.assertEqual(receipt["variants"]["baseline"]["status"], "blocked")
        self.assertEqual(receipt["error"]["type"], "network_error")

    def test_cli_missing_key_persists_blocked_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest_path = root / "case.json"
            output_path = root / "receipt.json"
            manifest_path.write_text(json.dumps(manifest(), ensure_ascii=False), encoding="utf-8")
            old_key = runtime.os.environ.pop("DASHSCOPE_API_KEY", None)
            try:
                exit_code = runtime.main([
                    "--manifest", str(manifest_path),
                    "--output-dir", str(root / "receipts"),
                    "--provider", "dashscope",
                ])
            finally:
                if old_key is not None:
                    runtime.os.environ["DASHSCOPE_API_KEY"] = old_key
            self.assertNotEqual(exit_code, 0)
            output_path = root / "receipts" / "test-case" / "receipt.json"
            receipt = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(receipt["status"], "blocked")
            self.assertEqual(receipt["error"]["type"], "authentication_missing")

    def test_invalid_manifest_is_rejected(self):
        invalid = manifest()
        invalid["baselinePrompt"] = invalid["improvedPrompt"]
        with self.assertRaises(runtime.ContractError):
            runtime.validate_manifest(invalid)

    def test_json_path_equals_traverses_objects_and_arrays_exactly(self):
        rules = [
            {"id": "third-label", "type": "jsonPathEquals", "path": "results.2.label", "value": "无法判断"},
            {"id": "typed-value", "type": "jsonPathEquals", "path": "results.0.score", "value": 1},
            {"id": "missing", "type": "jsonPathEquals", "path": "results.9.label", "value": "无法判断"},
        ]
        result = runtime.evaluate_response(
            json.dumps({"results": [{"score": True}, {}, {"label": "无法判断"}]}, ensure_ascii=False),
            rules,
        )
        self.assertEqual([item["status"] for item in result["checks"]], ["passed", "failed", "failed"])
        self.assertFalse(result["checks"][2]["path_found"])

    def test_regex_count_requires_exact_multiline_match_count(self):
        rule = {"id": "ten-items", "type": "regexCount", "pattern": r"^(?:[1-9]|10)\. ", "value": 10}
        ten_lines = "\n".join(f"{index}. item" for index in range(1, 11))
        eleven_lines = ten_lines + "\n1. duplicate"
        self.assertEqual(runtime.evaluate_response(ten_lines, [rule])["status"], "passed")
        failed = runtime.evaluate_response(eleven_lines, [rule])
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(failed["checks"][0]["actual"], 11)


if __name__ == "__main__":
    unittest.main()
