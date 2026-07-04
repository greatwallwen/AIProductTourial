# 会员积分增长方案（实操 42·方案验收）

> 数据来源：`dataset/ex-17-RFM.csv`（800 行，异常 10）。字段与指标均回到该数据。演示原理 2.7、3.1、4.1，采用设计 graphite-hud。

## 交付物

会员积分增长方案

## 验收清单

- 必含字段：会员、等级、积分、活跃、兑换、风险、责任人
- 必含指标链：会员数、活跃(近购≤30)率、高频(≥3)率、消费金额均值(元)、分层数
- 必含异常状态：活跃下滑、兑换异常、疑似刷分、留存预警
- 必含 Skill：growth-capstone、incentive-design、fraud-boundary

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得设计可被刷分套利的机制、保留反欺诈复核」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/ex-17-RFM.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/42`（设计 graphite-hud），截图 `assets/screenshots/premium_case_42_member_growth_capstone_desktop.png`。
