# 实操 14：需求变更控制｜航班准点运营调度

> **本案例演示/验证**：原理 3.4、4.1｜**采用设计** `amber-funnel`（见 [design/amber-funnel.md](../../design/amber-funnel.md)）

> **在数字化系统中的位置**：业务应用层 · 决策环节｜**理论→实操**：把原理 3.4、4.1 落成可运行操作：判断超时高发线路与单量增长城市，排出扩仓/扩城派单的优先级。（底座依赖 44/45/46/47）

> **角色镜头**：<img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> 项目 · <img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> 产品（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> **方法论落点**：单个案例 = SDD 流水线（§3.0）上一个可验收的小任务；一个中大型系统 = 许多这样的任务按方法论编排起来（完整走查见旗舰案例 51）。

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 进阶｜**一句话** 航班准点运营调度：按真实起飞城市延误/取消/原因，定位需增容的高延误枢纽｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：调度不是看航班量绝对值，而是看「延误率高 + 量大」的城市。本案 /api/dispatch 按真实起飞城市聚合真实延误——真实多城市差异（如 Tampa/Baltimore/Miami 延误率明显高于均值），延误原因(航司/天气/空管/前序航班晚到)也真算，据此定增容优先级。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：常见坑：① 只看航班量决定增容，忽略延误恶化信号；② 不区分延误原因（航司可控 vs 天气/空管不可控），一刀切改进无效；③ 把取消/备降混入延误统计，误判枢纽健康度。

### 项目场景故事

运营 PM 要判断哪些枢纽机场准点差、该增容或调度。本案用真实公开数据——美国 DOT《On-Time Performance》2024 年 6 月真实航班（公共领域，611k 班抽样 1500），按真实起飞城市算延误率、取消率、平均时长与延误原因，定位需增容/调度的高延误枢纽。全部真实，无合成叠加。

**现状问题**

- 决策依赖的关键指标：航班数、延误率、取消率、城市数、平均实际时效(h)。
- 现场常见异常：航班延误、航班取消、航班备降、枢纽承压。
- 只做通用页面无法支撑「按起飞城市真算延误率/取消率与延误原因，排出高延误枢纽的增容/调度优先级。」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `change-impact` 与 `release-risk` 完成分析，产出 `需求变更影响评估`，用 `rollback-plan` 验收。

### 任务目标与数据

- 行业：航空运输
- 真实业务场景：航班准点运营调度
- 岗位：运营产品经理
- 数据或资料：`dataset/product_cases/flights_ontime.csv`（1500 行，异常 406）
- 公开参考：https://www.transtats.bts.gov/（US DOT BTS On-Time Performance 2024-06，公共领域/美国政府作品）
- 行业字段：航班号、城市、航司、异常类型、责任方
- 指标链（真实值）：航班数 1500，延误率 25.6%，取消率 1.1%，城市数 164，平均实际时效(h) 2.33
- 决策动作：按起飞城市真算延误率/取消率与延误原因，排出高延误枢纽的增容/调度优先级。
- 风险边界：增容/调度须基于真实延误数据，不得脱离数据拍板
- UI 原型：`ui_14_logistics_change_control`（sales_funnel_screen）
- 采用设计：amber-funnel
- SaaS 组件：异常运单、时效趋势、城市单量、扩城开关、承运责任、回滚条件

### Prompt 实操

**Prompt 1：航班准点运营调度 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「航班准点运营调度」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：运营产品经理 面向「航班准点运营调度」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/product_cases/flights_ontime.csv`，只使用其中真实存在的字段（航班号、城市、航司、异常类型、责任方）。
- 指标链：航班数、延误率、取消率、城市数、平均实际时效(h)（当前真实值：航班数=1500，延误率=25.6%，取消率=1.1%，城市数=164，平均实际时效(h)=2.33）。
- 现场异常：要盯的是 航班延误、航班取消、航班备降、枢纽承压——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——按起飞城市真算延误率/取消率与延误原因，排出高延误枢纽的增容/调度优先级。
- 使用 Skill：用 change-impact、release-risk 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：需求变更影响评估，保存为 `outputs/product_case_library/case_14_logistics_change_control_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://www.transtats.bts.gov/（US DOT BTS On-Time Performance 2024-06，公共领域/美国政府作品））；不得越过「增容/调度须基于真实延误数据，不得脱离数据拍板」。
```

**Prompt 2：航班准点运营调度 - 方案验收**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「航班准点运营调度」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/product_cases/flights_ontime.csv`，只使用其中真实存在的字段（航班号、城市、航司、异常类型、责任方）。
- 指标链：航班数、延误率、取消率、城市数、平均实际时效(h)（当前真实值：航班数=1500，延误率=25.6%，取消率=1.1%，城市数=164，平均实际时效(h)=2.33）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/14`，按 `ui_14_logistics_change_control`（sales_funnel_screen）与设计 `amber-funnel` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 rollback-plan 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：需求变更影响评估，保存为 `outputs/product_case_library/case_14_logistics_change_control_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「增容/调度须基于真实延误数据，不得脱离数据拍板」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![航班准点运营调度 · 信息图](../../outputs/product_case_library/svg/case_14_logistics_change_control.svg)

![航班准点运营调度 · 可运行大屏原型截图](../../assets/screenshots/premium_case_14_logistics_change_control_desktop.png)

- 图形类型：logistics_change_control（设计 amber-funnel）
- 看图顺序：先看各起飞城市的真实延误率排序，再看延误原因构成（航司/天气/空管），最后定位延误率高+量大的增容枢纽。
- UI 差异：本案例采用 `ui_14_logistics_change_control` + 设计 `amber-funnel`，不得复用通用表格占位；可运行原型见 `#/case/14`。

### 交付物与验收

- 交付物：需求变更影响评估
- 必含字段：航班号、城市、航司、异常类型、责任方
- 必含指标链：航班数、延误率、取消率、城市数、平均实际时效(h)
- 必含异常状态：航班延误、航班取消、航班备降、枢纽承压
- 必含 Skill：change-impact、release-risk、rollback-plan

- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。
- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「增容/调度须基于真实延误数据，不得脱离数据拍板」。

**指定实操融合**

- RP03：产品评审会协作纪要
  - 产出：产品评审纪要, 验收口径清单
  - 验收：纪要必须覆盖需求、范围、风险、验收口径和责任人。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/14`（本案专属大屏）。
2. **你应看到**：指标链（航班数 / 延误率 / 取消率 …）、异常队列与责任对象、行动入口，数据全部来自真实后端实时计算。
3. **动手改一改**：找延误率最高的起飞城市，判断其延误主因是否可控(航司)；再对比一个高量但准点好的城市，想想调度优先级。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

为什么按起飞城市而非航司聚合延误？因为运营能直接调度的是城市侧资源。失效模式：把单月数据当长期规律（忽略季节性）。何时别用：延误主因是不可控天气时，调度优化收益有限，别硬做。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：在 `#/case/14` 里找出延误率最高的起飞城市，看它的主要延误原因是什么（航司/天气/空管？）。
2. **挑战**：设计一条「是否增容/调度」的判定规则（延误率阈值 + 航班量阈值），并说明为什么要先区分「可控延误原因(航司)」与「不可控(天气/空管)」再决定。

> **小结**：本案用「航班准点运营调度」演示原理 3.4、4.1，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/14`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
