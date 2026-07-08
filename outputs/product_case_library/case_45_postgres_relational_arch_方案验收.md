# 关系库查询与 PG 架构说明（实操 45·方案验收）

> 数据来源：`dataset/order_data.csv`（4500 行，异常 500）。字段与指标均回到该数据。演示原理 3.3、4.1，采用设计 steel-queue。

## 交付物

关系库查询与 PG 架构说明

## 验收清单

- 必含字段：SKU、品类、区域、金额、毛利率
- 必含指标链：表行数、区域数、品类数、总销售额(元)
- 必含异常状态：慢查询、全表扫描、空结果
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「本地 SQLite 演示、生产为 PostgreSQL；不得把演示数据当真账」。

## 验收结论

**PASS** — 指标链 4 项均为回到 `dataset/order_data.csv` 的实际计算值（真实基座 + 已标注教学合成叠加列）；字段/异常/Skill 齐备；可运行原型见 `#/case/45`（设计 steel-queue），截图 `assets/screenshots/premium_case_45_postgres_relational_arch_desktop.png`。
