# 目标用户与场景矩阵（实操 16·方案验收）

> 数据来源：`dataset/product_cases/hospital_scheduling.csv`（520 行，异常 61）。字段与指标均回到该数据。演示原理 2.7、3.2，采用设计 graphite-hud。

## 交付物

目标用户与场景矩阵

## 验收清单

- 必含字段：科室、医生、预约槽、等待时间、加号规则、人工协调
- 必含指标链：就诊数、号源利用率均值、爽约率、科室数、平均等待(分)
- 必含异常状态：招聘延期、人效偏低、编制超配、流失预警
- 必含 Skill：persona-scenario、journey-map、human-review

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动诊断或替代医生决策」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/product_cases/hospital_scheduling.csv` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/16`（设计 graphite-hud），截图 `assets/screenshots/premium_case_16_hospital_capacity_scheduler_desktop.png`。
