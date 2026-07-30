from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen-plus"
EVALUATOR_TYPES = {"requiredAny", "requiredAll", "forbidden", "validJson", "requiredJsonKeys", "jsonPathEquals", "regexCount", "maxChars"}


class ContractError(ValueError):
    pass


class ProviderError(RuntimeError):
    def __init__(self, kind: str, message: str, *, http_status: int | None = None) -> None:
        super().__init__(message)
        self.kind = kind
        self.http_status = http_status


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_value(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _required_text(manifest: dict[str, Any], key: str) -> str:
    value = manifest.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{key} must be a non-empty string")
    return value


def validate_manifest(manifest: Any) -> tuple[dict[str, Any], list[dict[str, str]]]:
    if not isinstance(manifest, dict):
        raise ContractError("manifest must be a JSON object")
    if manifest.get("schemaVersion") != "1.0":
        raise ContractError("schemaVersion must be 1.0")

    case_id = _required_text(manifest, "caseId")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", case_id):
        raise ContractError("caseId may contain only letters, numbers, dot, underscore, and hyphen")
    system_prompt = _required_text(manifest, "systemPrompt")
    shared_context = manifest.get("sharedContext")
    if not isinstance(shared_context, str):
        raise ContractError("sharedContext must be a string")
    baseline = _required_text(manifest, "baselinePrompt")
    improved = _required_text(manifest, "improvedPrompt")
    if baseline == improved:
        raise ContractError("baselinePrompt and improvedPrompt must differ")

    evaluators = manifest.get("evaluators")
    if not isinstance(evaluators, list) or not evaluators:
        raise ContractError("evaluators must be a non-empty array")
    seen_ids: set[str] = set()
    for index, rule in enumerate(evaluators):
        if not isinstance(rule, dict):
            raise ContractError(f"evaluators[{index}] must be an object")
        rule_id = rule.get("id")
        rule_type = rule.get("type")
        if not isinstance(rule_id, str) or not rule_id.strip() or rule_id in seen_ids:
            raise ContractError(f"evaluators[{index}].id must be unique and non-empty")
        seen_ids.add(rule_id)
        if rule_type not in EVALUATOR_TYPES:
            raise ContractError(f"evaluators[{index}].type is unsupported: {rule_type}")
        if rule_type in {"requiredAny", "requiredAll", "forbidden"}:
            values = rule.get("values")
            if not isinstance(values, list) or not values or any(not isinstance(value, str) or not value for value in values):
                raise ContractError(f"evaluators[{index}].values must be a non-empty string array")
        if rule_type == "maxChars" and (not isinstance(rule.get("value"), int) or rule["value"] < 0):
            raise ContractError(f"evaluators[{index}].value must be a non-negative integer")
        if rule_type == "requiredJsonKeys":
            keys = rule.get("keys")
            if not isinstance(keys, list) or not keys or any(not isinstance(key, str) or not key for key in keys):
                raise ContractError(f"evaluators[{index}].keys must be a non-empty string array")
        if rule_type == "jsonPathEquals":
            path = rule.get("path")
            if not isinstance(path, str) or not path or any(not part for part in path.split(".")):
                raise ContractError(f"evaluators[{index}].path must be a non-empty dot path")
            if "value" not in rule:
                raise ContractError(f"evaluators[{index}].value is required")
        if rule_type == "regexCount":
            pattern = rule.get("pattern")
            value = rule.get("value")
            if not isinstance(pattern, str) or not pattern:
                raise ContractError(f"evaluators[{index}].pattern must be a non-empty string")
            try:
                re.compile(pattern)
            except re.error as error:
                raise ContractError(f"evaluators[{index}].pattern is invalid: {error}") from error
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                raise ContractError(f"evaluators[{index}].value must be a non-negative integer")

    temperature = manifest.get("temperature", 0)
    if not isinstance(temperature, (int, float)) or isinstance(temperature, bool) or not 0 <= temperature <= 2:
        raise ContractError("temperature must be a number between 0 and 2")
    max_tokens = manifest.get("maxTokens", 1200)
    if not isinstance(max_tokens, int) or isinstance(max_tokens, bool) or max_tokens <= 0:
        raise ContractError("maxTokens must be a positive integer")
    model = manifest.get("model", DEFAULT_MODEL)
    if not isinstance(model, str) or not model.strip():
        raise ContractError("model must be a non-empty string")

    normalized = {
        "schemaVersion": "1.0",
        "caseId": case_id,
        "systemPrompt": system_prompt,
        "sharedContext": shared_context,
        "baselinePrompt": baseline,
        "improvedPrompt": improved,
        "model": model,
        "temperature": temperature,
        "maxTokens": max_tokens,
        "evaluators": evaluators,
    }
    checks = [
        {"id": "manifest-schema", "status": "passed"},
        {"id": "prompt-variants-distinct", "status": "passed"},
        {"id": "rubric-contract", "status": "passed"},
    ]
    return normalized, checks


def load_manifest(path: Path) -> tuple[dict[str, Any], list[dict[str, str]], str]:
    raw = path.read_bytes()
    try:
        value = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ContractError(f"manifest is not valid UTF-8 JSON: {error}") from error
    manifest, checks = validate_manifest(value)
    return manifest, checks, sha256_bytes(raw)


def build_request(prompt: str, manifest: dict[str, Any], model: str) -> dict[str, Any]:
    user_content = prompt
    if manifest["sharedContext"].strip():
        user_content = f"{manifest['sharedContext'].rstrip()}\n\n{prompt}"
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": manifest["systemPrompt"]},
            {"role": "user", "content": user_content},
        ],
        "temperature": manifest["temperature"],
        "max_tokens": manifest["maxTokens"],
    }


def resolve_json_path(value: Any, path: str) -> tuple[bool, Any]:
    current = value
    for part in path.split("."):
        if isinstance(current, dict):
            if part not in current:
                return False, None
            current = current[part]
        elif isinstance(current, list):
            if not part.isdigit():
                return False, None
            index = int(part)
            if index >= len(current):
                return False, None
            current = current[index]
        else:
            return False, None
    return True, current


def evaluate_response(text: str, evaluators: list[dict[str, Any]]) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    parsed_json: Any = None
    json_error: str | None = None
    try:
        parsed_json = json.loads(text)
    except json.JSONDecodeError as error:
        json_error = str(error)

    for rule in evaluators:
        rule_type = rule["type"]
        passed = False
        actual: Any = None
        expected: Any = rule.get("value", rule.get("values", rule.get("keys")))
        path_found: bool | None = None
        if rule_type == "requiredAny":
            actual = [value for value in rule["values"] if value in text]
            passed = bool(actual)
        elif rule_type == "requiredAll":
            actual = [value for value in rule["values"] if value in text]
            passed = len(actual) == len(rule["values"])
        elif rule_type == "forbidden":
            actual = [value for value in rule["values"] if value in text]
            passed = not actual
        elif rule_type == "maxChars":
            actual = len(text)
            passed = actual <= rule["value"]
        elif rule_type == "validJson":
            passed = json_error is None
            actual = "valid" if passed else json_error
            expected = "valid JSON"
        elif rule_type == "requiredJsonKeys":
            actual = sorted(parsed_json) if isinstance(parsed_json, dict) else []
            passed = isinstance(parsed_json, dict) and all(key in parsed_json for key in rule["keys"])
        elif rule_type == "jsonPathEquals":
            path_found, actual = resolve_json_path(parsed_json, rule["path"])
            passed = path_found and type(actual) is type(rule["value"]) and actual == rule["value"]
        elif rule_type == "regexCount":
            actual = len(re.findall(rule["pattern"], text, flags=re.MULTILINE))
            passed = actual == rule["value"]
        result = {
            "id": rule["id"],
            "type": rule_type,
            "status": "passed" if passed else "failed",
            "expected": expected,
            "actual": actual,
        }
        if rule_type == "jsonPathEquals":
            result["path"] = rule["path"]
            result["path_found"] = path_found
        results.append(result)
    return {
        "status": "passed" if all(item["status"] == "passed" for item in results) else "failed",
        "checks": results,
    }


def _redact(message: str, secret: str | None) -> str:
    if secret:
        message = message.replace(secret, "[REDACTED]")
    return message[:2000]


def _default_open(request: urllib.request.Request, timeout: float):
    return urllib.request.urlopen(request, timeout=timeout)


def call_dashscope(
    payload: dict[str, Any],
    *,
    api_key: str,
    base_url: str,
    timeout: float,
    opener: Callable[[urllib.request.Request, float], Any] = _default_open,
) -> tuple[dict[str, Any], int]:
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    request = urllib.request.Request(
        endpoint,
        data=canonical_json(payload),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with opener(request, timeout) as response:
            status = int(getattr(response, "status", 200))
            raw = response.read()
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace") if hasattr(error, "read") else str(error)
        kind = "authentication_error" if error.code in {401, 403} else "provider_http_error"
        raise ProviderError(kind, _redact(body or str(error), api_key), http_status=error.code) from error
    except urllib.error.URLError as error:
        raise ProviderError("network_error", _redact(str(error.reason), api_key)) from error
    except (OSError, TimeoutError) as error:
        raise ProviderError("network_error", _redact(str(error), api_key)) from error

    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProviderError("provider_protocol_error", f"invalid JSON response: {error}", http_status=status) from error
    if not isinstance(data, dict):
        raise ProviderError("provider_protocol_error", "response must be a JSON object", http_status=status)
    return data, status


def _response_record(data: dict[str, Any], http_status: int) -> tuple[dict[str, Any], str]:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise ProviderError("provider_protocol_error", "response has no choices")
    message = choices[0].get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise ProviderError("provider_protocol_error", "response has no assistant content")
    text = message["content"]
    metadata = {
        "http_status": http_status,
        "id": data.get("id"),
        "object": data.get("object"),
        "created": data.get("created"),
        "model": data.get("model"),
        "finish_reason": choices[0].get("finish_reason"),
        "system_fingerprint": data.get("system_fingerprint"),
    }
    record = {
        "text": text,
        "metadata": metadata,
        "usage": data.get("usage"),
        "response_hash": sha256_value(data),
        "text_hash": sha256_bytes(text.encode("utf-8")),
    }
    return record, text


def _base_receipt(
    manifest: dict[str, Any],
    *,
    manifest_file_hash: str,
    provider: str,
    base_url: str | None,
    model: str,
    contract_checks: list[dict[str, str]],
) -> dict[str, Any]:
    created = utc_now()
    return {
        "schema_version": "1.0",
        "receipt_type": "prompt-ab-experiment",
        "case_id": manifest["caseId"],
        "created_at_utc": created,
        "completed_at_utc": None,
        "status": "running",
        "provider": {"name": provider, "base_url": base_url, "model": model},
        "manifest": {
            "file_hash": manifest_file_hash,
            "normalized_hash": sha256_value(manifest),
        },
        "system_prompt": manifest["systemPrompt"],
        "shared_context": manifest["sharedContext"],
        "contract_evaluation": {"status": "passed", "checks": contract_checks},
        "variants": {},
        "error": None,
    }


def run_experiment(
    manifest: dict[str, Any],
    *,
    manifest_file_hash: str,
    contract_checks: list[dict[str, str]],
    provider: str,
    model_override: str | None = None,
    base_url: str = DEFAULT_BASE_URL,
    api_key: str | None = None,
    timeout: float = 60.0,
    opener: Callable[[urllib.request.Request, float], Any] = _default_open,
) -> tuple[dict[str, Any], int]:
    model = model_override or manifest["model"]
    receipt = _base_receipt(
        manifest,
        manifest_file_hash=manifest_file_hash,
        provider=provider,
        base_url=base_url if provider == "dashscope" else None,
        model=model,
        contract_checks=contract_checks,
    )

    for name, prompt_key in (("baseline", "baselinePrompt"), ("improved", "improvedPrompt")):
        prompt = manifest[prompt_key]
        payload = build_request(prompt, manifest, model)
        variant: dict[str, Any] = {
            "status": "not-run" if provider == "offline" else "running",
            "started_at_utc": None,
            "completed_at_utc": None,
            "prompt": prompt,
            "prompt_hash": sha256_bytes(prompt.encode("utf-8")),
            "request": {"payload": payload, "request_hash": sha256_value(payload)},
            "response": None,
            "evaluator": {"status": "not-run", "checks": []},
            "error": None,
        }
        receipt["variants"][name] = variant

    if provider == "offline":
        receipt["status"] = "not-run"
        receipt["completed_at_utc"] = utc_now()
        return receipt, 0

    if provider != "dashscope":
        raise ContractError(f"unsupported provider: {provider}")
    if not api_key:
        receipt["status"] = "blocked"
        receipt["error"] = {"type": "authentication_missing", "message": "DASHSCOPE_API_KEY is not set"}
        receipt["completed_at_utc"] = utc_now()
        return receipt, 3

    for name in ("baseline", "improved"):
        variant = receipt["variants"][name]
        variant["started_at_utc"] = utc_now()
        try:
            data, http_status = call_dashscope(
                variant["request"]["payload"],
                api_key=api_key,
                base_url=base_url,
                timeout=timeout,
                opener=opener,
            )
            response, text = _response_record(data, http_status)
            variant["response"] = response
            variant["evaluator"] = evaluate_response(text, manifest["evaluators"])
            variant["status"] = "completed"
        except ProviderError as error:
            variant["status"] = "blocked"
            variant["error"] = {
                "type": error.kind,
                "message": _redact(str(error), api_key),
                "http_status": error.http_status,
            }
            receipt["status"] = "blocked"
            receipt["error"] = {"variant": name, **variant["error"]}
            variant["completed_at_utc"] = utc_now()
            receipt["completed_at_utc"] = utc_now()
            return receipt, 3
        variant["completed_at_utc"] = utc_now()

    receipt["status"] = "completed"
    receipt["completed_at_utc"] = utc_now()
    return receipt, 0


def receipt_path(output_dir: Path, case_id: str) -> Path:
    return output_dir / case_id / "receipt.json"


def write_receipt(path: Path, receipt: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _blocked_contract_receipt(manifest_path: Path, provider: str, error: Exception) -> dict[str, Any]:
    try:
        file_hash = sha256_bytes(manifest_path.read_bytes())
    except OSError:
        file_hash = None
    now = utc_now()
    return {
        "schema_version": "1.0",
        "receipt_type": "prompt-ab-experiment",
        "case_id": None,
        "created_at_utc": now,
        "completed_at_utc": now,
        "status": "blocked",
        "provider": {"name": provider, "base_url": None, "model": None},
        "manifest": {"file_hash": file_hash, "normalized_hash": None},
        "system_prompt": None,
        "shared_context": None,
        "contract_evaluation": {"status": "failed", "checks": []},
        "variants": {},
        "error": {"type": "contract_error", "message": str(error)},
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a reproducible Prompt A/B experiment")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True, help="Root directory; receipt is written under <caseId>/receipt.json")
    parser.add_argument("--provider", choices=("offline", "dashscope"), default="offline")
    parser.add_argument("--model", help="Override manifest model")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--timeout", type=float, default=60.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        manifest, checks, file_hash = load_manifest(args.manifest)
        receipt, exit_code = run_experiment(
            manifest,
            manifest_file_hash=file_hash,
            contract_checks=checks,
            provider=args.provider,
            model_override=args.model,
            base_url=args.base_url,
            api_key=os.environ.get("DASHSCOPE_API_KEY"),
            timeout=args.timeout,
        )
    except (OSError, ContractError) as error:
        receipt = _blocked_contract_receipt(args.manifest, args.provider, error)
        exit_code = 2
    case_id = receipt.get("case_id") or "blocked-contract"
    output_path = receipt_path(args.output_dir, case_id)
    write_receipt(output_path, receipt)
    print(json.dumps({"status": receipt["status"], "receipt": str(output_path)}, ensure_ascii=False))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
