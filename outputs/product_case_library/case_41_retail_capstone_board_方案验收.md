# 零售经营产品方案（实操 41·方案验收）

> 数据来源：`dataset/order_data.csv`（1200 行，异常 225）。字段与指标均回到该数据。演示原理 2.7、3.1、4.1，采用设计 graphite-hud。

## 交付物

零售经营产品方案

## 验收清单

- 必含字段：商品、门店、销量、毛利、库存、复购、责任人
- 必含指标链：营收达成率、毛利率、复购率、动销率、责任闭环率
- 必含异常状态：目标未达成、滞销、毛利异常、责任未闭环
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得脱离数据编造结论」。

## 验收结论

PASS — 指标链 5 项、异常队列 225 项均回到 `dataset/order_data.csv`；可运行原型见工作台路由 `#/case/41`（设计 graphite-hud），截图 `assets/screenshots/premium_case_41_retail_capstone_board_desktop.png`。
