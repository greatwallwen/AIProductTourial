# 实操 01：技术任务转产品问题｜电商早会异常订单台

### 项目场景故事

电商运营团队每天早会第一件事，就是复盘昨天的经营与异常。本案用真实公开数据——UCI Online Retail II（一家英国在线零售商 2009–2010 年真实订单，CC BY 4.0），4500 单里：看哪些品类贡献收入（品类由真实商品描述归类）、哪些地区在增长（按真实国家聚合，英国占主力），并把真实退货单挑出来当场派人跟进。毛利率因原始数据无成本，为教学合成叠加、页面已标注。

> **本案例演示/验证**：原理 2.1、2.7｜**采用设计** `graphite-hud`（见 [design/graphite-hud.md](../../design/graphite-hud.md)）

> **在数字化系统中的位置**：业务应用层 · 洞察环节｜**理论→实操**：把原理 2.1、2.7 落成可运行操作：识别未达成区域、定位异常业务线，并生成责任部门行动队列。（依赖案例 05–06 的数据底座，本案可先不管）

> **角色镜头**：<img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> 产品 · <img src="../../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> 研发 · <img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> 项目（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 入门｜**一句话** 电商早会经营台：按真实订单看品类营收/区域结构/退货，把异常当场派成行动｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：早会的价值不在「看数」，而在「把昨天的信号今天就派出去」。本案 /api/retail 按品类真算销售额（真实数据里厨餐、家饰类目营收领先）、区域按真实国家聚合（英国占绝对主力），退货来自真实退货信号（教学过采样约 ×5，见 MANIFEST）——从看板变成行动。<img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> 毛利率为教学合成叠加（源无成本），不作真实经营结论。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：① 方案停在「分析」不落到「动作+责任+验收」；② 只看总数不按品类/区域下钻，真实的收入结构与退货高发点被平均掩盖；③ 把教学合成的毛利率当真实成本决策依据；④ 把「英国营收最高」当增长/经营强度信号——那只是**样本主场体量**（数据本就来自英国零售商，base-rate 假象，与案例02 放款率被规模混淆同型），异常率也是 ×5 教学过采样、非真实经营水平（真实约 2%）。

### 三镜头看同一个案例

> 同一份真实数据、同一个案例，研发/产品/项目三种角色各看到什么——这就是「一个操作模型、三个镜头」。

- <img src="../../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> **研发镜头**：把「异常订单」做成一个可跑的分诊 Loop：定时扫 order_data、按规则标记退货/缺货、输出结构化队列——关注数据管道、规则可维护、跑得稳，是内层 build/test loop。
- <img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> **产品镜头**：早会要回答「今天派谁去处理哪个异常」：定义指标链（销售额/退货率）、异常状态、责任人、验收口径——关注业务判断与可验收的行动，是中层 decision loop。
- <img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> **项目镜头**：把早会变成每日交付节奏：谁负责、几点前闭环、卡住如何升级、异常闭环率如何——关注责任分派、时限门禁、状态可追踪，是 delivery/governance loop。

**现状问题**

- 决策依赖的关键指标：订单数、销售额(元)、毛利率均值、异常订单率、区域数。
- 现场常见异常：目标未达成、区域下滑、异常订单、责任未闭环。
- 只做通用页面无法支撑「识别未达成区域、定位异常业务线，并生成责任部门行动队列。」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `problem-framing` 与 `metric-definition` 完成分析，产出 `产品问题定义卡`，用 `acceptance-criteria` 验收。

### 任务目标与数据

- 行业：电商零售
- 真实业务场景：电商早会异常订单台
- 岗位：运营主管
- 数据或资料：`dataset/order_data.csv`（4500 行，异常 500）
- 公开参考：https://archive.ics.uci.edu/dataset/502/online+retail+ii（真实英国电商订单，CC BY 4.0）
- 行业字段：订单号、SKU、库存天数、毛利率、异常原因、责任人、处理时限h
- 指标链（真实基座 + 已标注教学合成叠加列）：订单数 4500，销售额(元) 55373，毛利率均值 43.76%，异常订单率 11.1%，区域数 29
- 决策动作：识别未达成区域、定位异常业务线，并生成责任部门行动队列。
- 风险边界：不得把查询慢等同于产品问题
- UI 原型：`ui_01_morning_ops_grid`（executive_dashboard）
- 采用设计：graphite-hud
- SaaS 组件：目标达成、收入趋势、业务结构、区域排行、异常告警、行动队列

### Prompt 实操

> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见附录B）。

**Prompt 1：电商早会异常订单台 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「电商早会异常订单台」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：运营主管 面向「电商早会异常订单台」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/order_data.csv`，只使用其中实际存在的字段（订单号、SKU、库存天数、毛利率、异常原因、责任人、处理时限h）。
- 指标链：订单数、销售额(元)、毛利率均值、异常订单率、区域数（当前真实值：订单数=4500，销售额(元)=55373，毛利率均值=43.76%，异常订单率=11.1%，区域数=29）。
- 现场异常：要盯的是 目标未达成、区域下滑、异常订单、责任未闭环——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——识别未达成区域、定位异常业务线，并生成责任部门行动队列。
- 使用 Skill：用 problem-framing、metric-definition 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：产品问题定义卡，保存为 `outputs/product_case_library/case_01_morning_ops_grid_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://archive.ics.uci.edu/dataset/502/online+retail+ii（真实英国电商订单，CC BY 4.0））；不得越过「不得把查询慢等同于产品问题」。
```

**Prompt 2：电商早会异常订单台 - 方案验收**（注意：outputs/ 交付物由 build_docs 重建覆盖，建议在新分支/对照目录运行）

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「电商早会异常订单台」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/order_data.csv`，只使用其中实际存在的字段（订单号、SKU、库存天数、毛利率、异常原因、责任人、处理时限h）。
- 指标链：订单数、销售额(元)、毛利率均值、异常订单率、区域数（当前真实值：订单数=4500，销售额(元)=55373，毛利率均值=43.76%，异常订单率=11.1%，区域数=29）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/01`，按 `ui_01_morning_ops_grid`（executive_dashboard）与设计 `graphite-hud` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 acceptance-criteria 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：产品问题定义卡，保存为 `outputs/product_case_library/case_01_morning_ops_grid_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「不得把查询慢等同于产品问题」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![电商早会异常订单台 · 信息图](../../outputs/product_case_library/svg/case_01_morning_ops_grid.svg)

![电商早会异常订单台 · 可运行大屏原型截图](../../assets/screenshots/premium_case_01_morning_ops_grid_desktop.png)

- 图形类型：morning_ops_grid（设计 graphite-hud）
- 看图顺序：先看品类营收(真实)锁定收入支柱，再看区域结构(真实国家)，最后把真实退货单按金额排进派单队列。
- UI 差异：本案例采用 `ui_01_morning_ops_grid` + 设计 `graphite-hud`，不得复用通用表格占位；可运行原型见 `#/case/01`。

### 交付物与验收

交付物：**产品问题定义卡**。必含要素（字段/指标链/异常状态/Skill/决策动作/高影响复核）与合格线由自测器六项核对：`node code/tools/check_my_work.mjs 1 你的方案.md`；红线：不越过「不得把查询慢等同于产品问题」。

**指定实操融合**

- RP01：同一条软件需求的三种角色表达
  - 产出：角色差异卡, 产品问题清单
  - 验收：同一需求必须分别呈现研发视角、项目经理视角和产品经理视角，并能指出产品问题。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/01`（本案专属大屏）。
2. **你应看到**：指标链（订单数 / 销售额(元) …）、异常队列与行动入口，数据来自后端实时接口（性质见章首标注）。
3. **动手改一改**：换一个区域筛选，看品类营收怎么变；再点一单大额退货，想清楚该派给谁、几小时内闭环。
4. **自测产出**：`node code/tools/check_my_work.mjs 1 你的方案.md`——红项指明缺什么、回哪章补。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

为什么早会台盯「退货」而不只看销售额？退货是滞后但真实的质量信号——销售涨、退货也涨，是虚假繁荣。失效模式：把毛利率（教学合成叠加）当真做经营结论。何时别用：数据量小到肉眼能扫时，仪表盘是过度设计。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：打开 `#/case/01`，找出销售额最高的品类，说出它在真实数据里的退货(异常)率。
2. **挑战**：早会只有 10 分钟，你会把「大额退货订单」按什么排序让责任人先处理最该处理的？给出排序依据；并说明为什么「毛利率」这一列在本案不能当真实经营结论。

<details>
<summary>参考思路（先自己想，再展开）</summary>

- 这两题没有唯一标准答案，检验的是你能否把本案方法用自己的话讲出来：先按「跟着做」第 3 步真改一次、看指标怎么动，再对照上方「深度」折叠块的权衡与失效模式自评你的答案有没有踩坑。
- 答不顺就回读本案演示的原理小节 §2.1、§2.7；写成方案后跑 `node code/tools/check_my_work.mjs 1 你的方案.md`，红项会指明缺什么、回哪章补。
</details>

### 被追问（grill-me · 先自己答，再展开）

> 教员式追问：不给你标准答案，先逼你选、再点破误区。页内 `#/case/01` 有可交互版（答错即追问）。

**追问 1**：某品类昨天销售额环比大涨，运营说「最健康，加大投入」。同意吗？

- A. 同意，销量涨就是健康
- B. 先看退货率再下结论
- C. 看毛利率最高的才算健康

<details>
<summary>点破（先选再展开）</summary>

- 若选「同意，销量涨就是健康」：销量涨≠健康：退货是滞后信号，销售涨、退货同步涨就是「虚假繁荣」，得先看退货率。
- 若选「看毛利率最高的才算健康」：本案毛利率是无成本时的教学合成叠加列（页面已标注），拿它下经营结论是把假信号当真。
- 答对后再想一层：对——本案真正当场派人跟进的是真实退货单。那第二个陷阱：
</details>

**追问 2**：早会想用「毛利率最低」的品类当砍单依据，可以吗？

- A. 可以，毛利低就砍
- B. 不行，毛利率是合成列

<details>
<summary>点破（先选再展开）</summary>

- 若答错：毛利率在本案是教学合成叠加、页面明确标注「不当真实结论」——拿合成列做砍单决策正是本书反复警告的红线。
- 答对后再想一层：对。真要做盈利决策，先接真实成本。
</details>

> **所以真正的一课**：销售额涨≠经营健康（退货是滞后真信号）、毛利率是合成列不能当结论——真实数据里先分清「哪列是真、哪列是教学合成」，再谈决策。

> **小结**：本案用「电商早会异常订单台」演示原理 2.1、2.7，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/01`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
