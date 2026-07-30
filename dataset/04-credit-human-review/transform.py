from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
from prepare_dataset_cases import run

print(run("04"))
