# 子系统分解图与接口契约（实操 46·方案验收）

> 数据来源：`rules/backend.md`（46 行，异常 0）。字段与指标均回到该数据。演示原理 3.1、3.3，采用设计 cyan-matrix。

## 交付物

子系统分解图与接口契约

## 验收清单

- 必含字段：子系统、职责、接口、契约
- 必含指标链：子系统数、接口数、契约覆盖、健康检查
- 必含异常状态：职责越界、契约缺失、循环依赖
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「架构决策须可追溯（ADR），不得口头拍板」。

## 验收结论

PASS — 指标链 4 项、异常队列 0 项均回到 `rules/backend.md`；可运行原型见工作台路由 `#/case/46`（设计 cyan-matrix），截图 `assets/screenshots/premium_case_46_system_arch_flow_desktop.png`。
