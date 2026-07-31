from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "大模型与逻辑方法"
DEFAULT_OUTPUT = ROOT / "evidence" / "maintenance" / "logic-source-visual-audit.json"
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif"}

MANUAL_DISPOSITIONS = {
    "images/image1.png": ("exclude", "集合示意过于粗糙，且首章不需要用集合图解释命题。"),
    "images/image49.png": ("preserve-candidate", "幸存者偏差飞机图可用于第三章，使用前再核对来源。"),
    "images/image77.png": ("reference-only", "图中含 Our World in Data 品牌，保留为查证线索，不直接搬入交付物。"),
    "项目与逻辑关联/assets/screenshots/tbl-propositions.png": (
        "selected-reuse",
        "四列命题化对照与当前投诉案例直接相关，原图清楚且无需重绘。",
    ),
    "项目与逻辑关联/assets/screenshots/fig-three-steps.png": (
        "redraw-basis",
        "知识关系正确，但分辨率和排版不适合课程正文，作为新 SVG 的内容依据。",
    ),
    "项目与逻辑关联/assets/screenshots/fig-broken-chain.png": (
        "preserve-candidate",
        "断链结构有教学价值，留到第二章按统一视觉系统重绘。",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def image_size(path: Path) -> tuple[int | None, int | None]:
    data = path.read_bytes()
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if data.startswith((b"GIF87a", b"GIF89a")) and len(data) >= 10:
        return struct.unpack("<HH", data[6:10])
    if data.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 9 < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
                return width, height
            if offset + 4 > len(data):
                break
            length = struct.unpack(">H", data[offset + 2 : offset + 4])[0]
            if length < 2:
                break
            offset += 2 + length
    return None, None


def markdown_references() -> dict[Path, list[str]]:
    references: dict[Path, list[str]] = defaultdict(list)
    pattern = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
    for markdown in SOURCE.rglob("*.md"):
        text = markdown.read_text(encoding="utf-8")
        for raw_target in pattern.findall(text):
            target = raw_target.split()[0].strip("<>")
            if re.match(r"^[a-z]+://", target):
                continue
            resolved = (markdown.parent / target).resolve()
            if resolved.exists() and resolved.is_file():
                references[resolved].append(markdown.relative_to(SOURCE).as_posix())
    return references


def build_audit() -> dict:
    if not SOURCE.exists():
        raise FileNotFoundError(f"missing source folder: {SOURCE}")

    references = markdown_references()
    paths = sorted(
        path
        for path in SOURCE.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )
    hashes = {path: sha256(path) for path in paths}
    first_for_hash: dict[str, Path] = {}
    items: list[dict] = []

    for path in paths:
        relative = path.relative_to(SOURCE).as_posix()
        width, height = image_size(path)
        referenced_by = sorted(set(references.get(path.resolve(), [])))
        disposition, reason = MANUAL_DISPOSITIONS.get(relative, (None, None))
        duplicate_of = None

        if hashes[path] in first_for_hash:
            duplicate_of = first_for_hash[hashes[path]].relative_to(SOURCE).as_posix()
            if disposition is None:
                disposition = "duplicate"
                reason = "与另一张源图内容完全相同，融合时只保留一个引用。"
        else:
            first_for_hash[hashes[path]] = path

        if disposition is None:
            if referenced_by and width and height and width >= 900 and height >= 480:
                disposition = "preserve-candidate"
                reason = "源稿已引用且尺寸足够，进入对应章节时再做内容与来源复核。"
            elif referenced_by:
                disposition = "redraw-review"
                reason = "源稿已引用，但尺寸偏小或无法读取尺寸；保留内容，使用前判断是否重绘。"
            else:
                disposition = "unreferenced-review"
                reason = "没有在源 Markdown 中找到引用，默认不进入新教程。"

        items.append(
            {
                "path": relative,
                "bytes": path.stat().st_size,
                "sha256": hashes[path],
                "width": width,
                "height": height,
                "referencedBy": referenced_by,
                "disposition": disposition,
                "reason": reason,
                **({"duplicateOf": duplicate_of} if duplicate_of else {}),
            }
        )

    dispositions = Counter(item["disposition"] for item in items)
    tree_digest = hashlib.sha256()
    for item in items:
        tree_digest.update(item["path"].encode("utf-8"))
        tree_digest.update(item["sha256"].encode("ascii"))

    return {
        "schemaVersion": "1.0",
        "source": "大模型与逻辑方法",
        "policy": "先复用，再重绘；未确认来源或不服务教学的图片不进入正文。",
        "summary": {
            "images": len(items),
            "referencedImages": sum(bool(item["referencedBy"]) for item in items),
            "uniqueContentHashes": len(set(hashes.values())),
            "sourceImageTreeHash": tree_digest.hexdigest(),
            "dispositions": dict(sorted(dispositions.items())),
        },
        "items": items,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    result = build_audit()
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if not output.exists():
            print(f"missing visual audit: {output}")
            return 1
        if output.read_text(encoding="utf-8") != encoded:
            print("logic source visual audit is stale")
            return 1
        print(
            "logic source visual audit verified: "
            f"images={result['summary']['images']}, "
            f"unique={result['summary']['uniqueContentHashes']}"
        )
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(encoded, encoding="utf-8", newline="\n")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
