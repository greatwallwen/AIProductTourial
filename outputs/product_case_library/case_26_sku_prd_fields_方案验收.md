# PRD 片段（实操 26·方案验收）

> 数据来源：`dataset/sku.csv`（300 行，异常 171）。字段与指标均回到该数据。演示原理 2.4、3.1，采用设计 cyan-matrix。

## 交付物

PRD 片段

## 验收清单

- 必含字段：SKU、品类、销量、库存、阈值、提醒状态
- 必含指标链：SKU覆盖率、品类处理时长、销量异常数、库存完成率、阈值复核通过率
- 必含异常状态：字段缺失、流程超时、复核未完成、验收失败
- 必含 Skill：prd-fragment、acceptance-criteria、field-validation

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得使用数据集中不存在的字段」。

## 验收结论

PASS — 指标链 5 项、异常队列 171 项均回到 `dataset/sku.csv`；可运行原型见工作台路由 `#/case/26`（设计 cyan-matrix），截图 `assets/screenshots/premium_case_26_sku_prd_fields_desktop.png`。
