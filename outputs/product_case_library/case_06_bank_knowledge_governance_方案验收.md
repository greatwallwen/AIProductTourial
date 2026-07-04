# AI 产品工作流蓝图（实操 06·方案验收）

> 数据来源：`dataset/product_cases/aicourse_financial_transactions.csv`（900 行，异常 592）。字段与指标均回到该数据。演示原理 1.4、1.6，采用设计 emerald-flow。

## 交付物

AI 产品工作流蓝图

## 验收清单

- 必含字段：问题类别、知识来源、命中率、风险答案、人工接管、留痕编号
- 必含指标链：问题类别覆盖率、知识来源处理时长、命中率异常数、风险答案完成率、人工接管复核通过率
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：ai-product-boundary、eval-design、human-review

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得输出自动授信或最终处置建议」。

## 验收结论

PASS — 指标链 5 项、异常队列 592 项均回到 `dataset/product_cases/aicourse_financial_transactions.csv`；可运行原型见工作台路由 `#/case/06`（设计 emerald-flow），截图 `assets/screenshots/premium_case_06_bank_knowledge_governance_desktop.png`。
