# 涉众地图和价值交换图（实操 03·方案验收）

> 数据来源：`dataset/pm_network_cases/nyc_311_service_requests_5000.csv`（1500 行，异常 407）。本卡字段与指标均回到该数据，未使用数据外字段。

## 交付物

涉众地图和价值交换图

## 验收清单

- 必含字段：办件编号、材料名称、补正原因、承诺时限、经办窗口、审批科室、群众反馈
- 必含指标链：办件编号覆盖率、材料名称处理时长、补正原因异常数、承诺时限完成率、经办窗口复核通过率
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：stakeholder-map、service-blueprint、public-service-kpi

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得替代法定审批结论」。

## 验收结论

PASS — 指标链 5 项、异常队列 407 项均回到 `dataset/pm_network_cases/nyc_311_service_requests_5000.csv`；可运行原型见工作台路由 `#/case/03`，截图 `assets/screenshots/premium_case_03_gov_material_checklist_desktop.png`。高影响行业人工复核边界已在原型顶部横幅声明。
