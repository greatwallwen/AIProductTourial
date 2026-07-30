# Metric contract

Every metric contains:

- `metric_id`, display name, status, and calculation identifier;
- formula, filters, unit, null handling, and evidence basis;
- time-window status and a limitation when time is unavailable;
- `calculated` or `not_calculable`, never an invented substitute.

For the member experiment:

- count members with distinct non-empty `user_id` when available;
- treat `buy_count` as a behavior-count proxy, not revenue;
- calculate the full-issue coupon budget as target members multiplied by the explicit CNY coupon parameter;
- report historical revenue, recency, CLV, and ROI as unavailable without transaction amounts and absolute event times;
- treat `value_segment` as a course-derived engagement grouping, not a validated value label.
