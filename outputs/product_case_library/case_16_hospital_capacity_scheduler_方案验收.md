# 目标用户与场景矩阵（实操 16·方案验收）

> 数据来源：`dataset/product_cases/hospital_ed_timely.csv`（4077 行，异常 1330）。字段与指标均回到该数据。演示原理 2.7、3.2，采用设计 graphite-hud。

## 交付物

目标用户与场景矩阵

## 验收清单

- 必含字段：医院、州、急诊量级、中位急诊时长分、未就诊离开率、运营预警
- 必含指标链：医院数、中位急诊时长(分)、未就诊离开率均值、急诊量级数、高负荷预警率
- 必含异常状态：号源紧张、候诊超时、爽约高发、排班冲突
- 必含 Skill：persona-scenario、journey-map、human-review

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动改号/分诊或替代医生决策」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/product_cases/hospital_ed_timely.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/16`（设计 graphite-hud），截图 `assets/screenshots/premium_case_16_hospital_capacity_scheduler_desktop.png`。
