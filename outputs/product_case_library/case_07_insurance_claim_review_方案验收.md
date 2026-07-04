# 访谈提纲与洞察卡（实操 07·方案验收）

> 数据来源：`dataset/product_cases/aicourse_financial_transactions.csv`（900 行，异常 592）。字段与指标均回到该数据。演示原理 2.7、3.2，采用设计 steel-queue。

## 交付物

访谈提纲与洞察卡

## 验收清单

- 必含字段：案件号、理赔类型、申请金额、证据完整度、风险信号、复核人
- 必含指标链：交易数、风险信号率、高风险率、已复核率、平均金额(元)
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：grill-me、interview-synthesis、human-review

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动拒赔，必须保留人工复核」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/product_cases/aicourse_financial_transactions.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/07`（设计 steel-queue），截图 `assets/screenshots/premium_case_07_insurance_claim_review_desktop.png`。
