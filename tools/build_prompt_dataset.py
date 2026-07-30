from __future__ import annotations

import csv
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dataset" / "P-prompt-curriculum" / "agricultural-wholesale-price.csv"
PRODUCTS = [
    ("大白菜", "叶菜", 2.4),
    ("西红柿", "茄果", 4.8),
    ("黄瓜", "瓜菜", 4.2),
    ("土豆", "根茎", 3.1),
    ("白萝卜", "根茎", 2.2),
    ("洋葱", "根茎", 3.0),
    ("苹果", "水果", 7.6),
    ("梨", "水果", 6.4),
    ("香蕉", "水果", 5.5),
    ("猪肉", "畜产品", 24.0),
    ("鸡蛋", "畜产品", 9.2),
    ("草鱼", "水产品", 15.5),
]


def rows() -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for month_index in range(92):
        year = 2018 + month_index // 12
        month = month_index % 12 + 1
        for product_index, (product, category, base) in enumerate(PRODUCTS):
            season = math.sin((month - 1) / 12 * math.tau + product_index * 0.37)
            trend = month_index * (0.0025 + product_index * 0.00015)
            event = 0.0
            if product == "猪肉" and 20 <= month_index <= 31:
                event = 8.5 - abs(month_index - 25.5) * 0.8
            if product == "大白菜" and month_index in {45, 46}:
                event = 1.4
            price = max(0.8, base + base * 0.12 * season + trend + event)
            result.append(
                {
                    "year_month": f"{year:04d}-{month:02d}",
                    "product": product,
                    "price": f"{price:.2f}",
                    "category": category,
                }
            )
    return result


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["year_month", "product", "price", "category"])
        writer.writeheader()
        writer.writerows(rows())
    print(f"PROMPT DATASET BUILT rows={len(rows())} path={OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
