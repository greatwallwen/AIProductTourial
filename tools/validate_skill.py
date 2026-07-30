from __future__ import annotations

import re
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: validate_skill.py <skill-directory>")
    root = Path(sys.argv[1])
    document = root / "SKILL.md"
    if not document.is_file():
        fail("missing SKILL.md")
    text = document.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", text, flags=re.DOTALL)
    if not match:
        fail("SKILL.md must start with YAML front matter")
    front_matter = match.group(1)
    for field in ("name", "description"):
        if not re.search(rf"(?m)^{field}:\s*\S", front_matter):
            fail(f"missing front-matter field: {field}")
    print("Skill is valid!")


if __name__ == "__main__":
    main()
