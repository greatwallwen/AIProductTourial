# 需求变更影响评估（实操 14·方案验收）

> 数据来源：`dataset/product_cases/flights_ontime.csv`（1500 行，异常 406）。字段与指标均回到该数据。演示原理 3.4、4.1，采用设计 amber-funnel。

## 交付物

需求变更影响评估

## 验收清单

- 必含字段：航班号、城市、航司、异常类型、责任方
- 必含指标链：航班数、延误率、取消率、城市数、平均实际时效(h)
- 必含异常状态：航班延误、航班取消、航班备降、枢纽承压
- 必含 Skill：change-impact、release-risk、rollback-plan

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「增容/调度须基于真实延误数据，不得脱离数据拍板」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/product_cases/flights_ontime.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/14`（设计 amber-funnel），截图 `assets/screenshots/premium_case_14_logistics_change_control_desktop.png`。
