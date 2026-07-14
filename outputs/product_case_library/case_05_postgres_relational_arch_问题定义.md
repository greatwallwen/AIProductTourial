# 关系库查询与 PG 架构说明（实操 05·问题定义）

> 数据来源：`dataset/real/beijing_air_quality.csv`（140256 行，异常 10）。字段与指标均回到该数据。演示原理 3.3、4.1，采用设计 steel-queue。

## 产品问题

数据工程师要把 14 万行真实空气监测（北京 12 国控站逐时 PM2.5/PM10/气温）落成可秒查的关系库：真建表、真按站点/月份聚合、真 EXPLAIN。重点不是查出什么，而是让「规模/索引/执行计划」在真大表上可观测——无索引全表扫 vs 复合索引走索引，一眼分明。

## 岗位与业务对象

- 岗位：数据产品经理
- 业务对象：北京空气质量大表·查询优化与复合索引
- 行业：数据工程

## 指标链（真实基座 + 已标注教学合成叠加列）

- 表行数：140256
- 站点数：12
- 平均PM2.5：78.11
- 平均气温：13.52

## 异常状态与责任

- [待处理] Aotizhongxin / 0 / 4 → 责任 
- [待处理] Aotizhongxin / 3 / 6 → 责任 
- [待处理] Aotizhongxin / 6 / 3 → 责任 
- [待处理] Aotizhongxin / 9 / 3 → 责任 
- [待处理] Aotizhongxin / 12 / 3 → 责任 
- [待处理] Aotizhongxin / 15 / 8 → 责任 

## 决策动作

用真实 SQL（建表/索引/参数化聚合）支撑经营分析，讲清 PostgreSQL 架构

## 风险边界

本地 SQLite 演示、生产为 PostgreSQL；不得把演示数据当真账

## 使用 Skill

capstone-product-flow、evidence-pack、traceability-check
