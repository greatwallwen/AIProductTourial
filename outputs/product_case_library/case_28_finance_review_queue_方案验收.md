# 权限矩阵与风控规则（实操 28·方案验收）

> 数据来源：`dataset/reference_data_analysis/28-creditcardfraud_sample.csv`（600 行，异常 50）。本卡字段与指标均回到该数据，未使用数据外字段。

## 交付物

权限矩阵与风控规则

## 验收清单

- 必含字段：交易号、账户信号、风险等级、命中规则、证据摘要、复核权限、复核结论、留痕
- 必含指标链：高风险交易占比、人工复核完成率、规则命中准确率、误报率、升级处理时长
- 必含异常状态：高风险待复核、证据不足、权限越界、超时未处理
- 必含 Skill：risk-rule-design、human-review、compliance-boundary

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动处罚、不得自动授信、不得自动拒绝交易」。

## 验收结论

PASS — 指标链 5 项、异常队列 50 项均回到 `dataset/reference_data_analysis/28-creditcardfraud_sample.csv`；可运行原型见工作台路由 `#/case/28`，截图 `assets/screenshots/premium_case_28_finance_review_queue_desktop.png`。高影响行业人工复核边界已在原型顶部横幅声明。
