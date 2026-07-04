# 现状/优化流程图（实操 23·方案验收）

> 数据来源：`dataset/product_cases/aicourse_ecommerce_orders.csv`（1000 行，异常 799）。字段与指标均回到该数据。演示原理 3.3、3.5，采用设计 emerald-flow。

## 交付物

现状/优化流程图

## 验收清单

- 必含字段：售后单、客服审核、仓库收货、退款、补偿、超时原因
- 必含指标链：售后单数、异常率、SKU数、平均时效(天)、申请类型数
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：process-redesign、service-blueprint、acceptance-mapping

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得只增加按钮而不重构流程」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/product_cases/aicourse_ecommerce_orders.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/23`（设计 emerald-flow），截图 `assets/screenshots/premium_case_23_return_fulfillment_swimlane_desktop.png`。
