from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.build_demo_expansion import main

if __name__ == "__main__":
    raise SystemExit(main(["--case", "16", *sys.argv[1:]]))
