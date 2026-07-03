# 访谈提纲与洞察卡（实操 07·方案验收）

> 数据来源：`dataset/product_cases/aicourse_financial_transactions.csv`（900 行，异常 592）。本卡字段与指标均回到该数据，未使用数据外字段。

## 交付物

访谈提纲与洞察卡

## 验收清单

- 必含字段：案件号、理赔类型、申请金额、证据完整度、风险信号、复核人
- 必含指标链：案件号覆盖率、理赔类型处理时长、申请金额异常数、证据完整度完成率、风险信号复核通过率
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：grill-me、interview-synthesis、human-review

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动拒赔，必须保留人工复核」。

## 验收结论

PASS — 指标链 5 项、异常队列 592 项均回到 `dataset/product_cases/aicourse_financial_transactions.csv`；可运行原型见工作台路由 `#/case/07`，截图 `assets/screenshots/premium_case_07_insurance_claim_review_desktop.png`。高影响行业人工复核边界已在原型顶部横幅声明。
