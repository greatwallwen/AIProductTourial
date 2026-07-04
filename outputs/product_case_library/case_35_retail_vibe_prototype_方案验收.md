# React 原型需求卡（实操 35·方案验收）

> 数据来源：`dataset/order_data.csv`（1200 行，异常 225）。字段与指标均回到该数据。演示原理 2.3、4.3，采用设计 steel-queue。

## 交付物

React 原型需求卡

## 验收清单

- 必含字段：需求卡、页面目标、组件、字段、状态、截图
- 必含指标链：订单数、销售额(元)、毛利率均值、长库存(≥30天)率、责任人数
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：vibe-coding、ui-prompt-card、prototype-test

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得用页面效果替代字段和验收」。

## 验收结论

PASS — 指标链 5 项、异常队列 225 项均回到 `dataset/order_data.csv`；可运行原型见工作台路由 `#/case/35`（设计 steel-queue），截图 `assets/screenshots/premium_case_35_retail_vibe_prototype_desktop.png`。
