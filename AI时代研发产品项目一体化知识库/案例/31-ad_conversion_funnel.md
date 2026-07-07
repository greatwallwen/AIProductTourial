# 实操 31：漏斗分析｜广告投放转化复盘

### 项目场景故事

投放 PM 每周复盘各渠道漏斗：曝光→点击→转化→成本。6 个渠道里社交曝光最大但 CVR 未必高，信息流 CPA 可能更优。预算要按真实转化效率重新分配，而不是按曝光量。

> **本案例演示/验证**：原理 3.2、4.3｜**采用设计** `amber-funnel`（见 [design/amber-funnel.md](../../design/amber-funnel.md)）

> **在数字化系统中的位置**：能力智能层 · 洞察环节｜**理论→实操**：把原理 3.2、4.3 落成可运行操作：定位各渠道漏斗断点（曝光/点击/转化），把预算从量大挪到效率高的渠道。（数字化底座本身）

> **角色镜头**：<img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> 产品（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> **方法论落点**：单个案例 = SDD 流水线（§3.0）上一个可验收的小任务；一个中大型系统 = 许多这样的任务按方法论编排起来（完整走查见旗舰案例 51）。

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 进阶｜**一句话** 广告投放转化复盘：定位各渠道漏斗断点，把预算从量大挪到效率高的渠道｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：复盘关键是看「每个渠道的漏斗断点」：曝光高转化低是创意问题，点击高转化低是落地页问题。本案按渠道聚合真实曝光/点击/转化，才能把预算从「量大」挪到「效率高」。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：常见坑：① 只看曝光/点击等虚荣指标，不看 CPA/CVR；② 预算按历史惯性分配，不按当期真实转化效率复盘调整。

**现状问题**

- 决策依赖的关键指标：渠道数、总曝光、总点击、总转化、平均CPA。
- 现场常见异常：转化率下滑、CPA过高、创意点击低、落地页转化低。
- 只做通用页面无法支撑「定位各渠道漏斗断点（曝光/点击/转化），把预算从量大挪到效率高的渠道。」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `funnel-analysis` 与 `budget-decision` 完成分析，产出 `漏斗与预算建议`，用 `metric-definition` 验收。

### 任务目标与数据

- 行业：广告投放
- 真实业务场景：广告投放转化复盘
- 岗位：投放产品经理
- 数据或资料：`dataset/reference_data_analysis/18-ad_performance.csv`（30 行，异常 10）
- 公开参考：https://carbondesignsystem.com/
- 行业字段：活动、渠道、曝光、点击、转化、花费
- 指标链（真实值）：渠道数 6，总曝光 4383576，总点击 177419，总转化 12870，平均CPA 46.13
- 决策动作：定位各渠道漏斗断点（曝光/点击/转化），把预算从量大挪到效率高的渠道。
- 风险边界：不得只按点击率做预算决策
- UI 原型：`ui_31_ad_conversion_funnel`（sales_funnel_screen）
- 采用设计：amber-funnel
- SaaS 组件：渠道漏斗、曝光点击、转化成本、CPA排行、预算分配、创意诊断

### Prompt 实操

> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见 §2.6.1）。

**Prompt 1：广告投放转化复盘 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「广告投放转化复盘」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：投放产品经理 面向「广告投放转化复盘」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/reference_data_analysis/18-ad_performance.csv`，只使用其中真实存在的字段（活动、渠道、曝光、点击、转化、花费）。
- 指标链：渠道数、总曝光、总点击、总转化、平均CPA（当前真实值：渠道数=6，总曝光=4383576，总点击=177419，总转化=12870，平均CPA=46.13）。
- 现场异常：要盯的是 转化率下滑、CPA过高、创意点击低、落地页转化低——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——定位各渠道漏斗断点（曝光/点击/转化），把预算从量大挪到效率高的渠道。
- 使用 Skill：用 funnel-analysis、budget-decision 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：漏斗与预算建议，保存为 `outputs/product_case_library/case_31_ad_conversion_funnel_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://carbondesignsystem.com/）；不得越过「不得只按点击率做预算决策」。
```

**Prompt 2：广告投放转化复盘 - 方案验收**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「广告投放转化复盘」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/reference_data_analysis/18-ad_performance.csv`，只使用其中真实存在的字段（活动、渠道、曝光、点击、转化、花费）。
- 指标链：渠道数、总曝光、总点击、总转化、平均CPA（当前真实值：渠道数=6，总曝光=4383576，总点击=177419，总转化=12870，平均CPA=46.13）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/31`，按 `ui_31_ad_conversion_funnel`（sales_funnel_screen）与设计 `amber-funnel` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 metric-definition 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：漏斗与预算建议，保存为 `outputs/product_case_library/case_31_ad_conversion_funnel_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「不得只按点击率做预算决策」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![广告投放转化复盘 · 信息图](../../outputs/product_case_library/svg/case_31_ad_conversion_funnel.svg)

![广告投放转化复盘 · 可运行大屏原型截图](../../assets/screenshots/premium_case_31_ad_conversion_funnel_desktop.png)

- 图形类型：ad_conversion_funnel（设计 amber-funnel）
- 看图顺序：先按 CVR 给渠道排序，再看漏斗断点(曝光高转化低=创意问题；点击高转化低=落地页问题)，最后重分配预算。
- UI 差异：本案例采用 `ui_31_ad_conversion_funnel` + 设计 `amber-funnel`，不得复用通用表格占位；可运行原型见 `#/case/31`。

### 交付物与验收

- 交付物：漏斗与预算建议
- 必含字段：活动、渠道、曝光、点击、转化、花费
- 必含指标链：渠道数、总曝光、总点击、总转化、平均CPA
- 必含异常状态：转化率下滑、CPA过高、创意点击低、落地页转化低
- 必含 Skill：funnel-analysis、budget-decision、metric-definition

- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。
- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得只按点击率做预算决策」。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/31`（本案专属大屏）。
2. **你应看到**：指标链（渠道数 / 总曝光 / 总点击 …）、异常队列与责任对象、行动入口，数据全部来自真实后端实时计算。
3. **动手改一改**：找 CPA 最低的渠道，判断它是不是曝光最大的那个；给一个「把预算从量大挪到效率高」的方案。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

漏斗最隐蔽的坑是辛普森悖论：大盘 CVR 上升，拆开每个渠道可能都在降（只是高转化渠道占比变大）。所以要分渠道×分时段看。CPA/CVR 还强依赖「归因窗口」——首触/末触/多触归因会给出完全不同的渠道排名，预算决策前先说清用哪种归因。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：在 `#/case/31` 里找出 CPA 最低的渠道，它是不是曝光量最大的那个？
2. **挑战**：某渠道曝光高但转化低，你怎么判断是「创意问题」还是「落地页问题」？各给一个可执行的验证动作。

> **小结**：本案用「广告投放转化复盘」演示原理 3.2、4.3，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/31`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
