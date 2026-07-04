# Harness 验收清单（实操 36·方案验收）

> 数据来源：`outputs/05_harness/prototype_test_report.json`（12 行，异常 8）。字段与指标均回到该数据。演示原理 2.3、4.3，采用设计 cyan-matrix。

## 交付物

Harness 验收清单

## 验收清单

- 必含字段：字段、数据来源、状态、体验问题、风险项、修复优先级
- 必含指标链：字段覆盖率、数据来源处理时长、状态异常数、体验问题完成率、风险项复核通过率
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：harness-builder、checker-report、regression-guard

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得降低检查项换取通过」。

## 验收结论

PASS — 指标链 5 项、异常队列 8 项均回到 `outputs/05_harness/prototype_test_report.json`；可运行原型见工作台路由 `#/case/36`（设计 cyan-matrix），截图 `assets/screenshots/premium_case_36_prototype_harness_board_desktop.png`。
