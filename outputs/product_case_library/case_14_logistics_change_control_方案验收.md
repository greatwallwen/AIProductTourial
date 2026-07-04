# 需求变更影响评估（实操 14·方案验收）

> 数据来源：`dataset/product_cases/aicourse_logistics_delivery.csv`（700 行，异常 541）。字段与指标均回到该数据。演示原理 2.4、3.1，采用设计 amber-funnel。

## 交付物

需求变更影响评估

## 验收清单

- 必含字段：城市、运单、异常类型、规则版本、客服话术、回滚条件
- 必含指标链：线索数、商机转化率、合同金额、回款率、客户跟进超时数
- 必含异常状态：转化率下滑、回款逾期、客户跟进超时、区域掉队
- 必含 Skill：change-impact、release-risk、rollback-plan

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得在无回滚条件下扩大范围」。

## 验收结论

PASS — 指标链 5 项、异常队列 541 项均回到 `dataset/product_cases/aicourse_logistics_delivery.csv`；可运行原型见工作台路由 `#/case/14`（设计 amber-funnel），截图 `assets/screenshots/premium_case_14_logistics_change_control_desktop.png`。
