# 角色差异分析表（实操 02·方案验收）

> 数据来源：`dataset/product_cases/aicourse_hr_employees.csv`（145 行，异常 10）。本卡字段与指标均回到该数据，未使用数据外字段。

## 交付物

角色差异分析表

## 验收清单

- 必含字段：需求项、业务价值、研发工期、依赖团队、风险等级、上线目标
- 必含指标链：需求项覆盖率、业务价值处理时长、研发工期异常数、依赖团队完成率、风险等级复核通过率
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：role-transition、outcome-mapping、release-risk

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得只用进度解释产品优先级」。

## 验收结论

PASS — 指标链 5 项、异常队列 10 项均回到 `dataset/product_cases/aicourse_hr_employees.csv`；可运行原型见工作台路由 `#/case/02`，截图 `assets/screenshots/premium_case_02_value_schedule_axis_desktop.png`。
