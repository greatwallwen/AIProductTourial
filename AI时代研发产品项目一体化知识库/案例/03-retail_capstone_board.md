# 实操 03：综合闭环｜零售经营产品方案

### 项目场景故事

作为综合闭环案例，零售经营负责人要把「早会异常→驾驶舱洞察→RFM 会员分层→改进动作→责任闭环」串成一份可验收的经营方案。本案基于真实 UCI Online Retail II（4500 单真实英国电商订单 + 1665 位客户级 RFM 真算），把销售额、退货、区域结构与客户分层端到端形成从数据到方案的完整链路，独有产出是「高价值流失」群的抢救动作。毛利率为教学合成叠加、已标注。

> **本案例演示/验证**：原理 2.7、3.1、4.1｜**采用设计** `graphite-hud`（见 [design/graphite-hud.md](../../design/graphite-hud.md)）

> **在数字化系统中的位置**：业务应用层 · 增长环节｜**理论→实操**：把原理 2.7、3.1、4.1 落成可运行操作：从真实数据端到端得出零售经营改进方案并落成可验收交付物——本案的独有真实底座是「客户级 RFM 分层」（UCI 真算），据此锁定「高价值流失」群作为会员经营的抓手（数据底座另见案例 05–06）。

> **角色镜头**：<img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> 产品 · <img src="../../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> 研发 · <img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> 项目（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 高阶｜**一句话** 零售经营产品方案：从真实订单端到端得出经营改进方案并落成可验收交付物｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：综合案例的价值在「端到端可验收」+「独有真实洞见」：本案不与案例01 重复看品类，而是接入真实 RFM 客户分层（UCI 客户级真算），把「消费高却久未回购」的**高价值流失**群单拎出来当会员经营抓手——每个动作有责任人和验收标准。<img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> 「毛利洼地」基于教学合成毛利率、页面已标注，实操应换真实成本。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：① 方案停在「分析」不落到「动作+责任+验收」；② 脱离数据编经营结论——本案收入/区域/退货结论都回到 order_data 真实聚合；③ 把教学合成的毛利当真实成本决策依据。

### 三镜头看同一个案例

> 同一份真实数据、同一个案例，研发/产品/项目三种角色各看到什么——这就是「一个操作模型、三个镜头」。

- <img src="../../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> **研发镜头**：把经营数据落成可查询的关系库 + 可运行大屏（复用案例 05 的关系库底座）——关注数据接口、索引与性能。
- <img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> **产品镜头**：从真实数据得出「提毛利 / 清库存」的具体动作 + 验收标准——关注端到端可验收的经营方案。
- <img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> **项目镜头**：把方案排成带责任人、里程碑、门禁的交付计划——关注落地节奏与风险闭环。

**现状问题**

- 决策依赖的关键指标：营收(元)、毛利率均值、品类数、异常订单率、平均处理时限(h)。
- 现场常见异常：目标未达成、滞销、毛利异常、责任未闭环。
- 只做通用页面无法支撑「从数据端到端得出零售经营改进方案并落成可验收交付物」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `capstone-product-flow` 与 `evidence-pack` 完成分析，产出 `零售经营产品方案`，用 `traceability-check` 验收。

### 任务目标与数据

- 行业：零售经营
- 真实业务场景：零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群）
- 岗位：经营负责人
- 数据或资料：`dataset/order_data.csv`（4500 行，异常 500）
- 公开参考：https://archive.ics.uci.edu/dataset/502/online+retail+ii（真实英国电商订单，CC BY 4.0）
- 行业字段：SKU、品类、区域、金额、毛利率、库存天数、责任人
- 指标链（真实基座 + 已标注教学合成叠加列）：营收(元) 55373，毛利率均值 43.76%，品类数 10，异常订单率 11.1%，平均处理时限(h) 40.17
- 决策动作：从数据端到端得出零售经营改进方案并落成可验收交付物
- 风险边界：不得脱离数据编造结论
- UI 原型：`ui_41_retail_capstone_board`（executive_dashboard）
- 采用设计：graphite-hud
- SaaS 组件：目标达成、收入趋势、业务结构、区域排行、异常告警、行动队列

### Prompt 实操

> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见附录B）。

**Prompt 1：零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群） - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群）」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：经营负责人 面向「零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群）」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/order_data.csv`，只使用其中实际存在的字段（SKU、品类、区域、金额、毛利率、库存天数、责任人）。
- 指标链：营收(元)、毛利率均值、品类数、异常订单率、平均处理时限(h)（当前真实值：营收(元)=55373，毛利率均值=43.76%，品类数=10，异常订单率=11.1%，平均处理时限(h)=40.17）。
- 现场异常：要盯的是 目标未达成、滞销、毛利异常、责任未闭环——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——从数据端到端得出零售经营改进方案并落成可验收交付物
- 使用 Skill：用 capstone-product-flow、evidence-pack 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：零售经营产品方案，保存为 `outputs/product_case_library/case_03_retail_capstone_board_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://archive.ics.uci.edu/dataset/502/online+retail+ii（真实英国电商订单，CC BY 4.0））；不得越过「不得脱离数据编造结论」。
```

**Prompt 2：零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群） - 方案验收**（注意：outputs/ 交付物由 build_docs 重建覆盖，建议在新分支/对照目录运行）

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群）」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/order_data.csv`，只使用其中实际存在的字段（SKU、品类、区域、金额、毛利率、库存天数、责任人）。
- 指标链：营收(元)、毛利率均值、品类数、异常订单率、平均处理时限(h)（当前真实值：营收(元)=55373，毛利率均值=43.76%，品类数=10，异常订单率=11.1%，平均处理时限(h)=40.17）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/03`，按 `ui_41_retail_capstone_board`（executive_dashboard）与设计 `graphite-hud` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 traceability-check 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：零售经营产品方案，保存为 `outputs/product_case_library/case_03_retail_capstone_board_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「不得脱离数据编造结论」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群） · 信息图](../../outputs/product_case_library/svg/case_03_retail_capstone_board.svg)

![零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群） · 可运行大屏原型截图](../../assets/screenshots/premium_case_03_retail_capstone_board_desktop.png)

- 图形类型：retail_capstone_board（设计 graphite-hud）
- 看图顺序：先看经营现状(真实收入支柱/退货高发)，再看「现状→问题→动作→责任」方案，最后检查每条动作是否可验收。
- UI 差异：本案例采用 `ui_41_retail_capstone_board` + 设计 `graphite-hud`，不得复用通用表格占位；可运行原型见 `#/case/03`。

### 交付物与验收

交付物：**零售经营产品方案**。必含要素（字段/指标链/异常状态/Skill/决策动作/高影响复核）与合格线由自测器六项核对：`node code/tools/check_my_work.mjs 3 你的方案.md`；红线：不越过「不得脱离数据编造结论」。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/03`（本案专属大屏）。
2. **你应看到**：指标链（营收(元) / 毛利率均值 …）、异常队列与行动入口，数据来自后端实时接口（性质见章首标注）。
3. **动手改一改**：打开页面看真实 RFM：找出「高价值流失」群（消费高但久未回购），为它写一条带责任人 + 可验收标准（如「30 天内触达率≥60%、复购率 +3pct」）的抢救动作；另各挑一个「保供」「治退货」对象凑齐 3 条方案。
4. **自测产出**：`node code/tools/check_my_work.mjs 3 你的方案.md`——红项指明缺什么、回哪章补。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

为什么把「指标→分层→检索→决策」串成闭环，而非孤立看指标？孤立指标不产生行动，而 RFM 把 1665 位客户按 R(最近购买)×F(次数)×M(消费) 压成可行动的层级——「高价值流失」(M 高、R 大) 才是会员经营真正该抢救的群，占比虽小却价值最高，别被「一般保持/普通」的大盘带偏（又一处 base-rate 陷阱）。失效模式：闭环里任一环用了合成数据却当真（如拿合成毛利下成本结论）。何时别用：业务尚未定型时先手工跑几轮再自动化（§2「先建传感器再谈自动化」）。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：打开 `#/case/03`，从真实的「区域收入」和「品类退货率」各挑一个「要保供」和「要治理退货」的对象。
2. **挑战**：把本案分析写成一份「动作 + 责任人 + 验收标准」的经营方案（3 条即可），确保每一条都能被真实数据验证；指出哪一条依赖了教学合成的毛利、应如何补真实成本。

<details>
<summary>参考思路（先自己想，再展开）</summary>

- 这两题没有唯一标准答案，检验的是你能否把本案方法用自己的话讲出来：先按「跟着做」第 3 步真改一次、看指标怎么动，再对照上方「深度」折叠块的权衡与失效模式自评你的答案有没有踩坑。
- 答不顺就回读本案演示的原理小节 §2.7、§3.1、§4.1；写成方案后跑 `node code/tools/check_my_work.mjs 3 你的方案.md`，红项会指明缺什么、回哪章补。
</details>

### 被追问（grill-me · 先自己答，再展开）

> 教员式追问：不给你标准答案，先逼你选、再点破误区。页内 `#/case/03` 有可交互版（答错即追问）。

**追问 1**：交付了一叠漂亮的经营图表，综合方案就算完成了吗？

- A. 是，图全就算闭环
- B. 不是，每条动作要有责任人+验收
- C. 是，只要数据来自真实源

<details>
<summary>点破（先选再展开）</summary>

- 若选「是，图全就算闭环」：综合案例的价值不在图多，而在端到端可验收——没有责任人和验收标准的图，只是好看的 PPT。
- 若选「是，只要数据来自真实源」：数据真实是底线不是终点；闭环还要求每个动作可执行、可验收，且合成列（如毛利）不当真实结论。
- 答对后再想一层：对。那自动生成的「X品类毛利最低→复盘定价」这条，能直接上报吗？
</details>

**追问 2**：PlanScreen 自动生成的「X品类毛利最低→复盘定价」建议，可直接写进上报方案吗？

- A. 可以，系统算的
- B. 不行，基于合成毛利须先换真实成本

<details>
<summary>点破（先选再展开）</summary>

- 若答错：这条基于教学合成的毛利列——上报前必须换真实成本，否则把合成信号当经营结论。
- 答对后再想一层：对。综合闭环 = 真实数据 + 可验收动作 + 诚实标注合成。
</details>

> **所以真正的一课**：「综合闭环」不是图表堆叠，而是每条动作带责任人与验收、且绝不拿合成列（毛利）当上报结论——端到端可验收才算闭环。

> **小结**：本案用「零售综合闭环·高价值流失会员挽回（细分：真实 RFM 锁定 M高R大 群）」演示原理 2.7、3.1、4.1，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/03`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
