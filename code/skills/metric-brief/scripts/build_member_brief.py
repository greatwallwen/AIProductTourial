from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any


ENCODINGS = ("utf-8-sig", "utf-8", "gb18030")
MISSING_TOKENS = {"", "na", "n/a", "nan", "null", "none"}


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _is_missing(value: object) -> bool:
    return value is None or str(value).strip().lower() in MISSING_TOKENS


def _read_rows(path: Path) -> tuple[str, list[str], list[dict[str, str]]]:
    last_error: UnicodeDecodeError | None = None
    for encoding in ENCODINGS:
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                reader = csv.DictReader(handle)
                headers = list(reader.fieldnames or [])
                rows = [dict(row) for row in reader]
            return encoding, headers, rows
        except UnicodeDecodeError as error:
            last_error = error
    raise ValueError(f"unsupported_encoding:{last_error}")


def _decimal(value: str) -> Decimal | None:
    try:
        return Decimal(value.strip())
    except (InvalidOperation, AttributeError):
        return None


def _truthy(value: object) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def _metric(
    *,
    input_digest: str,
    metric_id: str,
    display_name: str,
    status: str,
    value: Any = None,
    unit: str | None = None,
    formula: str,
    filters: str = "none",
    limitation: str | None = None,
    basis: str = "observed",
) -> dict[str, Any]:
    return {
        "metric_id": metric_id,
        "display_name": display_name,
        "status": status,
        "value": value,
        "unit": unit,
        "formula": formula,
        "filters": filters,
        "time_window": {
            "status": "not_available",
            "reason": "源表没有绝对事件时间，不能构造时间窗口。",
        },
        "null_handling": "Exclude missing values from the metric denominator unless the formula says otherwise.",
        "calculation_id": f"{input_digest[:12]}:{metric_id}:v1",
        "basis": basis,
        "limitation": limitation,
    }


def build_metrics(
    input_path: str | Path,
    allowed_root: str | Path,
    *,
    coupon_amount_cny: Decimal,
    target_segment: str,
) -> dict[str, Any]:
    root = Path(allowed_root).resolve()
    path = Path(input_path).resolve()
    if not root.is_dir():
        raise ValueError("allowed_root_missing")
    if not _inside(path, root):
        raise ValueError("input_outside_allowed_root")
    if path.suffix.lower() != ".csv":
        raise ValueError("input_must_be_csv")
    if not path.is_file():
        raise ValueError("input_missing")
    if coupon_amount_cny <= 0:
        raise ValueError("coupon_amount_must_be_positive")

    before = path.stat()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    encoding, headers, rows = _read_rows(path)
    after = path.stat()
    if not headers:
        raise ValueError("missing_header")

    limitations = [
        "源表没有绝对事件时间，不能计算复购周期或最近购买时间。",
        "源表没有交易金额，不能计算历史收入、客单价、真实客户终身价值或优惠券 ROI。",
        "value_segment 是课程派生的行为参与度分层，不是经业务验证的客户价值标签。",
        "优惠券金额是实验参数，不是源表中的历史支出。",
    ]
    warnings: list[str] = []
    metrics: list[dict[str, Any]] = []

    user_values = [row.get("user_id", "") for row in rows]
    present_users = [str(value).strip() for value in user_values if not _is_missing(value)]
    member_count = len(set(present_users)) if "user_id" in headers else len(rows)
    member_formula = "COUNT(DISTINCT user_id)" if "user_id" in headers else "COUNT(*)"
    if "user_id" not in headers:
        warnings.append("missing_user_id:member_count_uses_rows")
    metrics.append(
        _metric(
            input_digest=digest,
            metric_id="member_count",
            display_name="会员数",
            status="calculated",
            value=member_count,
            unit="人",
            formula=member_formula,
        )
    )

    segment_counts: Counter[str] = Counter()
    if "value_segment" in headers:
        segment_counts.update(
            str(row.get("value_segment", "")).strip()
            for row in rows
            if not _is_missing(row.get("value_segment"))
        )
        segment_value = {
            segment: {
                "members": count,
                "share": round(count / member_count, 6) if member_count else 0.0,
            }
            for segment, count in sorted(segment_counts.items())
        }
        metrics.append(
            _metric(
                input_digest=digest,
                metric_id="segment_distribution",
                display_name="会员分层分布",
                status="calculated",
                value=segment_value,
                unit="人及占比",
                formula="COUNT(*) GROUP BY value_segment / member_count",
            )
        )
    else:
        metrics.append(
            _metric(
                input_digest=digest,
                metric_id="segment_distribution",
                display_name="会员分层分布",
                status="not_calculable",
                formula="COUNT(*) GROUP BY value_segment / member_count",
                limitation="缺少 value_segment 字段。",
            )
        )

    numeric_by_segment: dict[str, list[Decimal]] = defaultdict(list)
    buy_values: list[Decimal] = []
    if "buy_count" in headers:
        for row in rows:
            value = _decimal(str(row.get("buy_count", "")))
            if value is None:
                continue
            buy_values.append(value)
            segment = str(row.get("value_segment", "")).strip()
            if segment:
                numeric_by_segment[segment].append(value)
    if buy_values:
        average = (sum(buy_values) / Decimal(len(buy_values))).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        segment_averages = {
            segment: float(
                (sum(values) / Decimal(len(values))).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
            )
            for segment, values in sorted(numeric_by_segment.items())
        }
        metrics.append(
            _metric(
                input_digest=digest,
                metric_id="average_buy_count",
                display_name="人均购买次数代理",
                status="calculated",
                value={"overall": float(average), "by_segment": segment_averages},
                unit="次/会员",
                formula="SUM(valid buy_count) / COUNT(valid buy_count)",
                limitation="buy_count 是序列行为计数，不含金额与绝对时间。",
            )
        )
    else:
        metrics.append(
            _metric(
                input_digest=digest,
                metric_id="average_buy_count",
                display_name="人均购买次数代理",
                status="not_calculable",
                formula="SUM(valid buy_count) / COUNT(valid buy_count)",
                limitation="缺少可解析的 buy_count 值。",
            )
        )

    target_members = segment_counts.get(target_segment, 0)
    if segment_counts and target_segment not in segment_counts:
        raise ValueError(f"target_segment_not_found:{target_segment}")
    if segment_counts:
        budget = (Decimal(target_members) * coupon_amount_cny).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        metrics.append(
            _metric(
                input_digest=digest,
                metric_id="target_full_issue_budget",
                display_name=f"{target_segment}分层全量发券预算上限",
                status="calculated",
                value=float(budget),
                unit="CNY",
                formula="target_segment_members * coupon_amount_cny",
                filters=f"value_segment = {target_segment}",
                limitation="这是按实验参数计算的名义发券上限，不是实际核销成本。",
                basis="scenario",
            )
        )
    else:
        metrics.append(
            _metric(
                input_digest=digest,
                metric_id="target_full_issue_budget",
                display_name=f"{target_segment}分层全量发券预算上限",
                status="not_calculable",
                formula="target_segment_members * coupon_amount_cny",
                filters=f"value_segment = {target_segment}",
                limitation="缺少 value_segment 字段，无法识别目标分层人数。",
                basis="scenario",
            )
        )

    monetary_supported = "monetary_available" in headers and any(
        _truthy(row.get("monetary_available")) for row in rows
    )
    metrics.append(
        _metric(
            input_digest=digest,
            metric_id="historical_revenue",
            display_name="历史收入",
            status="not_calculable",
            formula="SUM(transaction_amount_cny)",
            limitation=(
                "源表没有 transaction_amount_cny 字段。"
                if monetary_supported
                else "monetary_available 全部为 false 或缺失，且源表没有交易金额。"
            ),
        )
    )
    recency_supported = "recency_available" in headers and any(
        _truthy(row.get("recency_available")) for row in rows
    )
    metrics.append(
        _metric(
            input_digest=digest,
            metric_id="purchase_recency",
            display_name="最近购买间隔",
            status="not_calculable",
            formula="reference_date - MAX(purchase_at)",
            limitation=(
                "源表没有 purchase_at 字段。"
                if recency_supported
                else "recency_available 全部为 false 或缺失，且源表没有绝对事件时间。"
            ),
        )
    )

    return {
        "schema_version": "1.0",
        "status": "complete",
        "business_question": f"面向会员经营实验，{coupon_amount_cny} 元优惠券是否应先在“{target_segment}”分层内测试？",
        "currency": "CNY",
        "source": {
            "path": str(path),
            "encoding": encoding,
            "bytes": before.st_size,
            "sha256": digest,
            "read_mode": "read-only-full-scan",
            "allowed_root": str(root),
            "source_write_performed": False,
            "source_stat_unchanged": (
                before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns
            ),
        },
        "parameters": {
            "coupon_amount_cny": float(coupon_amount_cny),
            "target_segment": target_segment,
        },
        "row_count": len(rows),
        "columns": headers,
        "metrics": metrics,
        "limitations": limitations,
        "warnings": warnings,
    }


def _metric_by_id(result: dict[str, Any], metric_id: str) -> dict[str, Any]:
    return next(item for item in result["metrics"] if item["metric_id"] == metric_id)


def render_brief(result: dict[str, Any]) -> str:
    members = _metric_by_id(result, "member_count")
    segments = _metric_by_id(result, "segment_distribution")
    average = _metric_by_id(result, "average_buy_count")
    budget = _metric_by_id(result, "target_full_issue_budget")
    target = result["parameters"]["target_segment"]
    coupon = result["parameters"]["coupon_amount_cny"]

    facts = [f"样本包含 {members['value']:,} 名会员。"]
    if segments["status"] == "calculated":
        target_info = segments["value"].get(target, {"members": 0, "share": 0.0})
        facts.append(
            f"“{target}”分层有 {target_info['members']:,} 人，占 {target_info['share']:.2%}。"
        )
    else:
        facts.append(f"会员分层不可计算：{segments['limitation']}")
    if average["status"] == "calculated":
        target_average = average["value"]["by_segment"].get(target)
        suffix = f"；“{target}”分层为 {target_average:.4f} 次/会员" if target_average is not None else ""
        facts.append(
            f"全体人均购买次数代理为 {average['value']['overall']:.4f} 次/会员{suffix}。"
        )
    else:
        facts.append(f"购买次数代理不可计算：{average['limitation']}")
    if budget["status"] == "calculated":
        facts.append(
            f"若向该分层每人名义发放 ¥{coupon:.2f}，全量面额上限为 ¥{budget['value']:,.2f}；"
            "这不是实际核销成本。"
        )
    else:
        facts.append(f"发券预算上限不可计算：{budget['limitation']}")

    lines = [
        "# 会员经营实验简报",
        "",
        f"> {result['business_question']}",
        "",
        "## 事实",
        "",
    ]
    lines.extend(f"{index}. {fact}" for index, fact in enumerate(facts[:4], start=1))
    lines.extend(
        [
            "",
            "## 解释",
            "",
            f"- 将“{target}”分层作为候选实验对象只是待验证假设；现有数据不能证明优惠券会提升购买。",
            "- value_segment 是行为参与度代理，不等同于真实客户价值或客户终身价值。",
            "- 缺少交易金额和绝对事件时间，因此不能给出历史收入、客单价、最近购买间隔或 ROI。",
            "",
            "## 下一步",
            "",
            f"1. 在“{target}”分层内随机分配实验组和对照组，预先登记发券、核销、增量购买及毛利口径。",
            "2. 补充带绝对时间和人民币交易金额的事件数据，再评估收入、复购和 ROI。",
            "",
            "## 限制",
            "",
        ]
    )
    lines.extend(f"- {item}" for item in result["limitations"])
    return "\n".join(lines) + "\n"


def _write_text(path_value: str | None, content: str, input_path: Path) -> Path | None:
    if not path_value:
        return None
    target = Path(path_value).resolve()
    if target == input_path:
        raise ValueError("output_must_not_overwrite_input")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a traceable member experiment brief.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--coupon-amount-cny", default="8")
    parser.add_argument("--target-segment", default="成长")
    parser.add_argument("--metrics-output", required=True)
    parser.add_argument("--brief-output", required=True)
    args = parser.parse_args()
    try:
        coupon_amount = Decimal(args.coupon_amount_cny)
        result = build_metrics(
            args.input,
            args.allowed_root,
            coupon_amount_cny=coupon_amount,
            target_segment=args.target_segment,
        )
        input_path = Path(args.input).resolve()
        metrics_path = _write_text(
            args.metrics_output,
            json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            input_path,
        )
        brief_path = _write_text(args.brief_output, render_brief(result), input_path)
    except (InvalidOperation, OSError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2

    print(
        json.dumps(
            {
                "status": "complete",
                "row_count": result["row_count"],
                "metrics_output": str(metrics_path),
                "brief_output": str(brief_path),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
