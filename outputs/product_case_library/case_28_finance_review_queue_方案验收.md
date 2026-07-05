# 权限矩阵与风控规则（实操 28·方案验收）

> 数据来源：`dataset/reference_data_analysis/28-credit_default_sample.csv`（3000 行，异常 1365）。字段与指标均回到该数据。演示原理 3.3、3.5，采用设计 cyan-matrix。

## 交付物

权限矩阵与风控规则

## 验收清单

- 必含字段：交易号、额度档、账单金额、最近逾期月数、风险信号、风险等级、命中规则数、复核
- 必含指标链：账户数、高风险率、待复核率、平均命中规则数、额度档数
- 必含异常状态：高风险待复核、证据不足、权限越界、超时未处理
- 必含 Skill：risk-rule-design、human-review、compliance-boundary

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动处罚、不得自动授信、不得自动拒绝交易」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/reference_data_analysis/28-credit_default_sample.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/28`（设计 cyan-matrix），截图 `assets/screenshots/premium_case_28_finance_review_queue_desktop.png`。
