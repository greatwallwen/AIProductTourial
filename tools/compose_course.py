from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "md" / "course-structure.json"


def load_manifest() -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != "1.0":
        raise ValueError("unsupported course structure schema")
    chapters = manifest.get("chapters")
    if not isinstance(chapters, list) or not chapters:
        raise ValueError("course structure must contain chapters")
    if len({entry.get("file") for entry in chapters}) != len(chapters):
        raise ValueError("course structure contains duplicate chapter files")
    return manifest


def inside_root(relative_path: str) -> Path:
    path = (ROOT / relative_path).resolve()
    root = ROOT.resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"path escapes repository: {relative_path}")
    return path


def canonical_part(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip("\n") + "\n"


def chapter_text(entry: dict) -> str:
    path = inside_root(entry["file"])
    if not path.is_file():
        raise FileNotFoundError(f"missing chapter: {entry['file']}")
    text = canonical_part(path.read_text(encoding="utf-8"))
    heading = entry["start_heading"] + "\n"
    if not text.startswith(heading):
        raise ValueError(f"{entry['file']} must start with {entry['start_heading']!r}")
    rewrite = entry.get("rewrite_links")
    if rewrite:
        text = text.replace(rewrite["from"], rewrite["to"])
    return text


def compose(manifest: dict) -> str:
    return "\n\n".join(chapter_text(entry).rstrip("\n") for entry in manifest["chapters"]) + "\n"


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
    print(f"COURSE COMPOSITION PASSED command={args.command} chapters={len(manifest['chapters'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
