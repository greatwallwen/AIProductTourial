# 实操 28：权限与风控规则｜金融复核工作台

### 项目场景故事

风控 PM 面对信用卡客户的违约复核。本案用真实公开数据——UCI《Default of Credit Card Clients》（3 万名台湾信用卡客户 2005 年真实违约与逐月还款记录，CC BY 4.0），抽样 3000 名客户。真实数据揭示一个反直觉现象：低额度客户违约率反而最高。人工复核有限，要按风险等级×账单金额优先。

> **本案例演示/验证**：原理 3.3、3.5｜**采用设计** `cyan-matrix`（见 [design/cyan-matrix.md](../../design/cyan-matrix.md)）

> **在数字化系统中的位置**：业务应用层 · 执行环节｜**理论→实操**：把原理 3.3、3.5 落成可运行操作：按风险等级×金额×命中规则排序复核队列，把有限人工投给最该看的高风险交易。（依赖案例 44–47 的数据底座，本案可先不管）

> **角色镜头**：<img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> 产品 · <img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> 项目 · <img src="../../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> 研发（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> **方法论落点**：单个案例 = SDD 流水线（§3.0）上一个可验收的小任务；一个中大型系统 = 许多这样的任务按方法论编排起来（完整走查见旗舰案例 51）。

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 进阶｜**一句话** 金融复核工作台：真实信用卡违约数据，按风险等级×账单金额排序，低额度违约最高｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：复核不是把所有高风险都人工看一遍（看不完），而是按「风险等级 × 账单金额」排序。本案 /api/riskreview 按真实额度档真算高风险率——真实反直觉：低额度客户违约率最高，明显高于高额度客户。风险分级与命中规则均由真实逐月还款状态(PAY_*)与违约标记派生，非编造。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：常见坑：① 规则命中就自动拦，误伤率高；② 全靠人工，复核不过来；③ 高影响（金融）却让模型自动拒绝交易/授信，未保留人工复核与申诉；④ 想当然「高额度=高风险」，忽略真实数据里低额度反而违约最高。

**现状问题**

- 决策依赖的关键指标：账户数、高风险率、待复核率、平均命中规则数、额度档数。
- 现场常见异常：高风险待复核、证据不足、权限越界、超时未处理。
- 只做通用页面无法支撑「按风险等级×金额×命中规则排序复核队列，把有限人工投给最该看的高风险交易。」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `risk-rule-design` 与 `human-review` 完成分析，产出 `权限矩阵与风控规则`，用 `compliance-boundary` 验收。

### 任务目标与数据

- 行业：金融风控
- 真实业务场景：金融复核工作台
- 岗位：风控产品经理
- 数据或资料：`dataset/reference_data_analysis/28-credit_default_sample.csv`（3000 行，异常 1365）
- 公开参考：https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients（真实信用卡客户违约，CC BY 4.0）
- 行业字段：交易号、额度档、账单金额、最近逾期月数、风险信号、风险等级、命中规则数、复核
- 指标链（真实值）：账户数 3000，高风险率 37.8%，待复核率 45.5%，平均命中规则数 1.18，额度档数 3
- 决策动作：按风险等级×金额×命中规则排序复核队列，把有限人工投给最该看的高风险交易。
- 风险边界：不得自动处罚、不得自动授信、不得自动拒绝交易（高影响行业·人工复核）
- UI 原型：`ui_28_finance_review_queue`（finance_cashflow_screen）
- 采用设计：cyan-matrix
- SaaS 组件：复核队列、风险分级、命中规则、证据摘要、人工处置、留痕升级

### Prompt 实操

> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见 §2.6.1）。

**Prompt 1：金融复核工作台 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「金融复核工作台」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：风控产品经理 面向「金融复核工作台」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/reference_data_analysis/28-credit_default_sample.csv`，只使用其中真实存在的字段（交易号、额度档、账单金额、最近逾期月数、风险信号、风险等级、命中规则数、复核）。
- 指标链：账户数、高风险率、待复核率、平均命中规则数、额度档数（当前真实值：账户数=3000，高风险率=37.8%，待复核率=45.5%，平均命中规则数=1.18，额度档数=3）。
- 现场异常：要盯的是 高风险待复核、证据不足、权限越界、超时未处理——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——按风险等级×金额×命中规则排序复核队列，把有限人工投给最该看的高风险交易。
- 使用 Skill：用 risk-rule-design、human-review 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：权限矩阵与风控规则，保存为 `outputs/product_case_library/case_28_finance_review_queue_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients（真实信用卡客户违约，CC BY 4.0））；不得越过「不得自动处罚、不得自动授信、不得自动拒绝交易」；高影响行业保留人工复核。
```

**Prompt 2：金融复核工作台 - 方案验收**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「金融复核工作台」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/reference_data_analysis/28-credit_default_sample.csv`，只使用其中真实存在的字段（交易号、额度档、账单金额、最近逾期月数、风险信号、风险等级、命中规则数、复核）。
- 指标链：账户数、高风险率、待复核率、平均命中规则数、额度档数（当前真实值：账户数=3000，高风险率=37.8%，待复核率=45.5%，平均命中规则数=1.18，额度档数=3）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/28`，按 `ui_28_finance_review_queue`（finance_cashflow_screen）与设计 `cyan-matrix` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 compliance-boundary 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：权限矩阵与风控规则，保存为 `outputs/product_case_library/case_28_finance_review_queue_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「不得自动处罚、不得自动授信、不得自动拒绝交易」；高影响行业保留人工复核；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![金融复核工作台 · 信息图](../../outputs/product_case_library/svg/case_28_finance_review_queue.svg)

![金融复核工作台 · 可运行大屏原型截图](../../assets/screenshots/premium_case_28_finance_review_queue_desktop.png)

- 图形类型：finance_review_queue（设计 cyan-matrix）
- 看图顺序：先看额度档×高风险率(真实反直觉)，再看高优先复核队列(风险×账单金额)，最后想人工复核该先看谁。
- UI 差异：本案例采用 `ui_28_finance_review_queue` + 设计 `cyan-matrix`，不得复用通用表格占位；可运行原型见 `#/case/28`。

### 交付物与验收

- 交付物：权限矩阵与风控规则
- 必含字段：交易号、额度档、账单金额、最近逾期月数、风险信号、风险等级、命中规则数、复核
- 必含指标链：账户数、高风险率、待复核率、平均命中规则数、额度档数
- 必含异常状态：高风险待复核、证据不足、权限越界、超时未处理
- 必含 Skill：risk-rule-design、human-review、compliance-boundary

- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。
- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动处罚、不得自动授信、不得自动拒绝交易」。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/28`（本案专属大屏）。
2. **你应看到**：指标链（账户数 / 高风险率 / 待复核率 …）、异常队列与责任对象、行动入口，数据全部来自真实后端实时计算。
3. **动手改一改**：对比三档额度的违约率（结果反直觉），设计一个复核排序打分；并说明为什么金融不能自动拒付。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

为什么低额度违约率反而最高？警惕「筛选偏差」：低额度客户往往是先被风控判为高风险、才只给低额度——用结果反推原因会误导。评分卡上线还要防 population stability 漂移、特征泄漏（用了未来信息）、群体公平性（同一规则对不同人群的误伤率是否一致）。这些都属能力地图 L2/L3。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：在 `#/case/28` 里对比三档额度的高风险率，说出违约率最高的是哪一档（提示：结果反直觉）。
2. **挑战**：复核人力只够看 20% 的账户。设计一个排序打分（风险等级 × 账单金额 × 命中规则），并解释为什么金融高影响场景绝不能让系统自动拒付/自动授信。

> **小结**：本案用「金融复核工作台」演示原理 3.3、3.5，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/28`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
