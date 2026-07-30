from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "md" / "course-structure.json"


def load_manifest() -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != "2.0":
        raise ValueError("unsupported course structure schema")
    sections = manifest.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("course structure must contain sections")
    if len({entry.get("file") for entry in sections}) != len(sections):
        raise ValueError("course structure contains duplicate section files")
    case_ids = [entry.get("id") for entry in sections if entry.get("kind") == "case"]
    expected_case_ids = [f"B{index:03d}" for index in range(1, 25)]
    if case_ids != expected_case_ids:
        raise ValueError(f"course cases must be B001-B024 in order, got {case_ids}")
    return manifest


def inside_root(relative_path: str) -> Path:
    path = (ROOT / relative_path).resolve()
    root = ROOT.resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"path escapes repository: {relative_path}")
    return path


def canonical_part(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip("\n") + "\n"


def section_text(entry: dict, manifest: dict) -> str:
    path = inside_root(entry["file"])
    if not path.is_file():
        raise FileNotFoundError(f"missing course section: {entry['file']}")
    text = canonical_part(path.read_text(encoding="utf-8"))
    if entry.get("kind") == "case":
        expected = f"# 综合案例 {entry['id']}"
        if not text.startswith(expected):
            raise ValueError(f"{entry['file']} must start with {expected!r}")
        rewrites = manifest.get("case_link_rewrites", [])
    else:
        heading = entry["start_heading"] + "\n"
        if not text.startswith(heading):
            raise ValueError(f"{entry['file']} must start with {entry['start_heading']!r}")
        rewrites = []
    rewrites = [*rewrites, *entry.get("rewrite_links", [])]
    for rewrite in rewrites:
        text = text.replace(rewrite["from"], rewrite["to"])
    return text


def compose(manifest: dict) -> str:
    return "\n\n".join(
        section_text(entry, manifest).rstrip("\n") for entry in manifest["sections"]
    ) + "\n"


def output_path(manifest: dict) -> Path:
    return inside_root(manifest["output"])


def build(manifest: dict) -> None:
    output = output_path(manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(compose(manifest), encoding="utf-8", newline="\n")


def check(manifest: dict) -> None:
    output = output_path(manifest)
    actual = output.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    expected = compose(manifest)
    if actual != expected:
        raise ValueError(f"{manifest['output']} differs from the modular course sources")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose the complete course from the public modular sources.")
    parser.add_argument("command", choices=("build", "check"))
    args = parser.parse_args()
    try:
        manifest = load_manifest()
        build(manifest) if args.command == "build" else check(manifest)
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"COURSE COMPOSITION FAILED: {exc}", file=sys.stderr)
        return 1
    cases = sum(entry.get("kind") == "case" for entry in manifest["sections"])
    print(
        "COURSE COMPOSITION PASSED "
        f"command={args.command} sections={len(manifest['sections'])} cases={cases}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
