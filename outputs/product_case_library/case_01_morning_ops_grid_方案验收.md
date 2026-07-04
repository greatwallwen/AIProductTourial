# 产品问题定义卡（实操 01·方案验收）

> 数据来源：`dataset/order_data.csv`（1200 行，异常 225）。字段与指标均回到该数据。演示原理 1.1、1.7，采用设计 graphite-hud。

## 交付物

产品问题定义卡

## 验收清单

- 必含字段：订单号、SKU、库存天数、毛利率、异常原因、责任人、处理时限
- 必含指标链：经营目标达成率、销售额同比、区域贡献、异常订单数、责任部门闭环率
- 必含异常状态：目标未达成、区域下滑、异常订单、责任未闭环
- 必含 Skill：problem-framing、metric-definition、acceptance-criteria

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得把查询慢等同于产品问题」。

## 验收结论

PASS — 指标链 5 项、异常队列 225 项均回到 `dataset/order_data.csv`；可运行原型见工作台路由 `#/case/01`（设计 graphite-hud），截图 `assets/screenshots/premium_case_01_morning_ops_grid_desktop.png`。
