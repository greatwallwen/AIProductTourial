# RFM 分层运营策略（实操 30·方案验收）

> 数据来源：`dataset/reference_data_analysis/2-air_data.csv`（800 行，异常 800）。字段与指标均回到该数据。演示原理 1.3、3.0，采用设计 amber-funnel。

## 交付物

RFM 分层运营策略

## 验收清单

- 必含字段：会员号、卡等级、最近乘机天数、年飞行次数、年消费、分层、里程余额
- 必含指标链：会员数、年飞行次数均值、年消费总额(元)、高价值分层占比、里程余额均值
- 必含异常状态：高价值流失、里程临期、久未乘机、权益未用
- 必含 Skill：rfm-segmentation、lifecycle-action、privacy-boundary

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得输出歧视性或不可解释规则」。

## 验收结论

**PASS** — 指标链 5 项均为回到 `dataset/reference_data_analysis/2-air_data.csv` 的实际计算值（教学合成数据（固定种子，非真实业务））；字段/异常/Skill 齐备；可运行原型见 `#/case/30`（设计 amber-funnel），截图 `assets/screenshots/premium_case_30_airline_member_rfm_desktop.png`。
