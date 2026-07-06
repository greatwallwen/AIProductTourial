# 第二部分 · 案例演示与验证

## 数字化系统全景（先看这张图）

第一部分讲的理念、原理、规范、设计，不是散点——它们共同构成**一套数字化系统**。下面 11 个代表性案例，正是这套系统在不同环节、不同层的**实操演示**（每案标注它更偏哪个角色镜头）：

![数字化系统全景](../../outputs/product_case_library/svg/fig_system_panorama.svg)

- **纵向三层**：`底座平台`（44 向量库·45 关系库·46 架构契约·47 三维）→ `能力智能`（指标/检索/AI）→ `业务应用`（业务场景）。
- **横向数据价值闭环**：`采集 → 治理 → 洞察 → 决策 → 执行 → 验收 → 增长`，再反馈回采集。
- **怎么读**：先在全景里定位一个案例在「哪一层·哪一环节」，再进它看它把哪条理论落成了什么操作。

## 案例总览

| # | 场景 | 行业 | 演示原理 | 设计 | 链接 |
|---|---|---|---|---|---|
| 01 | 电商早会异常订单台 | 电商零售 | 2.1/2.7 | graphite-hud | [打开](01-morning_ops_grid.md) |
| 14 | 航班准点运营调度 | 航空运输 | 3.4/4.1 | amber-funnel | [打开](14-logistics_change_control.md) |
| 16 | 医院急诊及时性运营 | 医疗运营 | 2.7/3.2 | graphite-hud | [打开](16-hospital_capacity_scheduler.md) |
| 28 | 金融复核工作台 | 金融风控 | 3.3/3.5 | cyan-matrix | [打开](28-finance_review_queue.md) |
| 30 | 航空会员价值运营 | 航空会员 | 3.2/4.3 | amber-funnel | [打开](30-airline_member_rfm.md) |
| 31 | 广告投放转化复盘 | 广告投放 | 3.2/4.3 | amber-funnel | [打开](31-ad_conversion_funnel.md) |
| 41 | 零售经营产品方案 | 零售经营 | 2.7/3.1/4.1 | graphite-hud | [打开](41-retail_capstone_board.md) |
| 44 | 产品知识库语义检索 | AI 应用 | 1.3/3.3 | emerald-flow | [打开](44-rag_knowledge_retrieval.md) |
| 45 | 经营数据关系库查询 | 数据工程 | 3.3/4.1 | steel-queue | [打开](45-postgres_relational_arch.md) |
| 46 | 后端子系统分解与契约 | 系统架构 | 3.1/3.3 | cyan-matrix | [打开](46-system_arch_flow.md) |
| 47 | 经营三维散点可视化 | 数据可视化 | 3.3/5.1 | graphite-hud | [打开](47-three_d_scatter.md) |

## 原理 → 案例 反查（哪个原理，被哪些案例演示）

> 读完第一部分某个原理，想看它怎么落地？按这张表直达（自动从各案 `demonstrates` 反转，只列被真实演示到的原理）。

| 原理 | 演示它的案例 |
|---|---|
| §1.3 | [案例 44](44-rag_knowledge_retrieval.md) |
| §2.1 | [案例 01](01-morning_ops_grid.md) |
| §2.7 | [案例 01](01-morning_ops_grid.md)、[案例 16](16-hospital_capacity_scheduler.md)、[案例 41](41-retail_capstone_board.md) |
| §3.1 | [案例 41](41-retail_capstone_board.md)、[案例 46](46-system_arch_flow.md) |
| §3.2 | [案例 16](16-hospital_capacity_scheduler.md)、[案例 30](30-airline_member_rfm.md)、[案例 31](31-ad_conversion_funnel.md) |
| §3.3 | [案例 28](28-finance_review_queue.md)、[案例 44](44-rag_knowledge_retrieval.md)、[案例 45](45-postgres_relational_arch.md)、[案例 46](46-system_arch_flow.md)、[案例 47](47-three_d_scatter.md) |
| §3.4 | [案例 14](14-logistics_change_control.md) |
| §3.5 | [案例 28](28-finance_review_queue.md) |
| §4.1 | [案例 14](14-logistics_change_control.md)、[案例 41](41-retail_capstone_board.md)、[案例 45](45-postgres_relational_arch.md) |
| §4.3 | [案例 30](30-airline_member_rfm.md)、[案例 31](31-ad_conversion_funnel.md) |
| §5.1 | [案例 47](47-three_d_scatter.md) |
