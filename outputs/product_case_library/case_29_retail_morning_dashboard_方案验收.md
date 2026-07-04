# 经营分析指标卡（实操 29·方案验收）

> 数据来源：`dataset/order_data.csv`（1200 行，异常 225）。字段与指标均回到该数据。演示原理 3.2、4.3，采用设计 graphite-hud。

## 交付物

经营分析指标卡

## 验收清单

- 必含字段：门店、SKU、销售额、毛利率、异常、责任人
- 必含指标链：订单数、销售额(元)、客单价(元)、动销SKU数、异常订单率
- 必含异常状态：目标未达成、区域下滑、异常订单、责任未闭环
- 必含 Skill：dashboard-requirement、kpi-tree、action-summary

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得只展示指标，不给出行动入口」。

## 验收结论

PASS — 指标链 5 项、异常队列 225 项均回到 `dataset/order_data.csv`；可运行原型见工作台路由 `#/case/29`（设计 graphite-hud），截图 `assets/screenshots/premium_case_29_retail_morning_dashboard_desktop.png`。
