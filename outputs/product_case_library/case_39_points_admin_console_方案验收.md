# React 后台页面（实操 39·方案验收）

> 数据来源：`dataset/ex-17-RFM.csv`（800 行，异常 10）。字段与指标均回到该数据。演示原理 2.3、4.3，采用设计 graphite-hud。

## 交付物

React 后台页面

## 验收清单

- 必含字段：任务、权益、积分成本、等级、风控、运营动作
- 必含指标链：会员数、最近购买天数均值、购买频次均值、消费金额均值(元)、高价值分层占比
- 必含异常状态：招聘延期、人效偏低、编制超配、流失预警
- 必含 Skill：react-ui、shadcn-admin、accessibility-check

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得让运营动作和成本脱节」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/ex-17-RFM.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/39`（设计 graphite-hud），截图 `assets/screenshots/premium_case_39_points_admin_console_desktop.png`。
