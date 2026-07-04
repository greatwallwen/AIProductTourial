# 漏斗与预算建议（实操 31·方案验收）

> 数据来源：`dataset/reference_data_analysis/18-ad_performance.csv`（6 行，异常 6）。字段与指标均回到该数据。演示原理 3.2、4.3，采用设计 amber-funnel。

## 交付物

漏斗与预算建议

## 验收清单

- 必含字段：渠道、曝光、点击、注册、订单、预算
- 必含指标链：线索数、商机转化率、合同金额、回款率、客户跟进超时数
- 必含异常状态：转化率下滑、回款逾期、客户跟进超时、区域掉队
- 必含 Skill：funnel-analysis、budget-decision、metric-definition

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得只按点击率做预算决策」。

## 验收结论

PASS — 指标链 5 项、异常队列 6 项均回到 `dataset/reference_data_analysis/18-ad_performance.csv`；可运行原型见工作台路由 `#/case/31`（设计 amber-funnel），截图 `assets/screenshots/premium_case_31_ad_conversion_funnel_desktop.png`。
