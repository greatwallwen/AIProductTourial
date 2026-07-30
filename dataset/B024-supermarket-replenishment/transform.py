from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.prepare_expansion_cases import main

if __name__ == '__main__':
    raise SystemExit(main(['--case', 'B024', *sys.argv[1:]]))
