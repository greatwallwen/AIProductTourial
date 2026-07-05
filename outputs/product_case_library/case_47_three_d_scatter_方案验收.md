# 三维散点可视化方案（实操 47·方案验收）

> 数据来源：`dataset/order_data.csv`（4500 行，异常 500）。字段与指标均回到该数据。演示原理 3.3、5.1，采用设计 graphite-hud。

## 交付物

三维散点可视化方案

## 验收清单

- 必含字段：品类、单价、数量、金额
- 必含指标链：数据点数、品类数、最大金额(元)、客单价均值(元)
- 必含异常状态：离群点、空品类
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「三维仅作探索，不替代统计结论」。

## 验收结论

**PASS** — 指标链 4 项均为回到 `dataset/order_data.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/47`（设计 graphite-hud），截图 `assets/screenshots/premium_case_47_three_d_scatter_desktop.png`。
