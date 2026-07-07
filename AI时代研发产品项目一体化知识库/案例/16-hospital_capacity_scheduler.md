# 实操 16：目标用户与场景｜医院急诊及时性运营

### 项目场景故事

医疗运营 PM 要在有限急诊资源下缩短患者等待、减少「未就诊离开」。本案用真实公开数据——CMS《Timely and Effective Care - Hospital》（美国数千家医院急诊及时性指标，公共领域），4077 家医院的真实数据显示一个清晰规律：急诊量级越高，中位等待越长（极高量级约 199 分 vs 低量级约 124 分）、未就诊离开率也越高。增容/分流要按量级差异施策。

> **本案例演示/验证**：原理 2.7、3.2｜**采用设计** `graphite-hud`（见 [design/graphite-hud.md](../../design/graphite-hud.md)）

> **在数字化系统中的位置**：业务应用层 · 洞察环节｜**理论→实操**：把原理 2.7、3.2 落成可运行操作：判断各科室号源利用率与等待/爽约，形成放号、加号与分时预约的调度动作。（依赖案例 44–47 的数据底座，本案可先不管）

> **角色镜头**：<img src="../../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> 产品 · <img src="../../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> 项目（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> **方法论落点**：单个案例 = SDD 流水线（§3.0）上一个可验收的小任务；一个中大型系统 = 许多这样的任务按方法论编排起来（完整走查见旗舰案例 51）。

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 入门｜**一句话** 医院急诊及时性：按真实急诊量级看等待与未就诊离开，定位需增容/分流的高负荷急诊｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：急诊运营的抓手是「量级 × 等待 × 流失」：本案 /api/hospital 按真实急诊量级(EDV)真算中位急诊等待与未就诊离开率——真实单调效应：量级越高越承压（极高≈199 分、低≈124 分）。高负荷医院要增容/分流，而非一刀切。高影响（医疗）：系统只给建议、不自动改号。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：常见坑：① 一刀切增容/限流，不看量级差异；② 把「未就诊离开」当患者问题，不查急诊承压与分流；③ 高影响（医疗）却让系统自动改号/自动分诊，未留人工复核。

**现状问题**

- 决策依赖的关键指标：医院数、中位急诊时长(分)、未就诊离开率均值、急诊量级数、高负荷预警率。
- 现场常见异常：号源紧张、候诊超时、爽约高发、排班冲突。
- 只做通用页面无法支撑「判断各科室号源利用率与等待/爽约，形成放号、加号与分时预约的调度动作。」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `persona-scenario` 与 `journey-map` 完成分析，产出 `目标用户与场景矩阵`，用 `human-review` 验收。

### 任务目标与数据

- 行业：医疗运营
- 真实业务场景：医院急诊及时性运营
- 岗位：医疗运营产品经理
- 数据或资料：`dataset/product_cases/hospital_ed_timely.csv`（4077 行，异常 1330）
- 公开参考：https://data.cms.gov/provider-data/dataset/yv7e-xc69（CMS Timely and Effective Care - Hospital，公共领域）
- 行业字段：医院、州、急诊量级、中位急诊时长分、未就诊离开率、运营预警
- 指标链（真实值）：医院数 4077，中位急诊时长(分) 157.08，未就诊离开率均值 1.57%，急诊量级数 5，高负荷预警率 32.6%
- 决策动作：判断各科室号源利用率与等待/爽约，形成放号、加号与分时预约的调度动作。
- 风险边界：不得自动改号/分诊或替代医生决策（高影响行业·人工复核）
- UI 原型：`ui_16_hospital_capacity_scheduler`（hr_efficiency_screen）
- 采用设计：graphite-hud
- SaaS 组件：号源利用率、候诊时长、科室排班、加号规则、爽约预警、分时预约

### Prompt 实操

> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见 §2.6.1）。

**Prompt 1：医院急诊及时性运营 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「医院急诊及时性运营」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：医疗运营产品经理 面向「医院急诊及时性运营」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/product_cases/hospital_ed_timely.csv`，只使用其中真实存在的字段（医院、州、急诊量级、中位急诊时长分、未就诊离开率、运营预警）。
- 指标链：医院数、中位急诊时长(分)、未就诊离开率均值、急诊量级数、高负荷预警率（当前真实值：医院数=4077，中位急诊时长(分)=157.08，未就诊离开率均值=1.57%，急诊量级数=5，高负荷预警率=32.6%）。
- 现场异常：要盯的是 号源紧张、候诊超时、爽约高发、排班冲突——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——判断各科室号源利用率与等待/爽约，形成放号、加号与分时预约的调度动作。
- 使用 Skill：用 persona-scenario、journey-map 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：目标用户与场景矩阵，保存为 `outputs/product_case_library/case_16_hospital_capacity_scheduler_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://data.cms.gov/provider-data/dataset/yv7e-xc69（CMS Timely and Effective Care - Hospital，公共领域））；不得越过「不得自动改号/分诊或替代医生决策」；高影响行业保留人工复核。
```

**Prompt 2：医院急诊及时性运营 - 方案验收**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「医院急诊及时性运营」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/product_cases/hospital_ed_timely.csv`，只使用其中真实存在的字段（医院、州、急诊量级、中位急诊时长分、未就诊离开率、运营预警）。
- 指标链：医院数、中位急诊时长(分)、未就诊离开率均值、急诊量级数、高负荷预警率（当前真实值：医院数=4077，中位急诊时长(分)=157.08，未就诊离开率均值=1.57%，急诊量级数=5，高负荷预警率=32.6%）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/16`，按 `ui_16_hospital_capacity_scheduler`（hr_efficiency_screen）与设计 `graphite-hud` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 human-review 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：目标用户与场景矩阵，保存为 `outputs/product_case_library/case_16_hospital_capacity_scheduler_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「不得自动改号/分诊或替代医生决策」；高影响行业保留人工复核；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![医院急诊及时性运营 · 信息图](../../outputs/product_case_library/svg/case_16_hospital_capacity_scheduler.svg)

![医院急诊及时性运营 · 可运行大屏原型截图](../../assets/screenshots/premium_case_16_hospital_capacity_scheduler_desktop.png)

- 图形类型：hospital_capacity_scheduler（设计 graphite-hud）
- 看图顺序：先看急诊量级×中位等待(真实)的单调关系，再看未就诊离开率，最后定位需增容/分流的高负荷量级。
- UI 差异：本案例采用 `ui_16_hospital_capacity_scheduler` + 设计 `graphite-hud`，不得复用通用表格占位；可运行原型见 `#/case/16`。

### 交付物与验收

- 交付物：目标用户与场景矩阵
- 必含字段：医院、州、急诊量级、中位急诊时长分、未就诊离开率、运营预警
- 必含指标链：医院数、中位急诊时长(分)、未就诊离开率均值、急诊量级数、高负荷预警率
- 必含异常状态：号源紧张、候诊超时、爽约高发、排班冲突
- 必含 Skill：persona-scenario、journey-map、human-review

- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。
- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得自动改号/分诊或替代医生决策」。

**指定实操融合**

- RP04：用户体验五层与服务蓝图
  - 产出：用户体验地图, 服务蓝图, 用户故事, 体验五层拆解
  - 验收：体验地图、用户故事和服务蓝图必须描述同一个用户任务。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/16`（本案专属大屏）。
2. **你应看到**：指标链（医院数 / 中位急诊时长(分) / 未就诊离开率均值 …）、异常队列与责任对象、行动入口，数据全部来自真实后端实时计算。
3. **动手改一改**：对比极高与低量级的等待差，设计一个「系统建议 + 人工复核」的分流流程，标出人工介入点。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

为什么用急诊量级而非号源？量级是真实负荷信号，号源是被安排出来的噪声。失效模式：把等待时长的地区差异当医院优劣（混杂了病情严重度）。何时别用：高影响医疗决策必须人工复核，不可自动派单。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：打开 `#/case/16`，对比不同急诊量级的中位等待，说出等待最长的量级（并看它的未就诊离开率是否也最高）。
2. **挑战**：医疗是高影响行业、系统不得自动改号。为「高负荷急诊增容/分流」设计一个「系统建议 + 人工复核」流程，指出人工必须在哪一步介入。

> **小结**：本案用「医院急诊及时性运营」演示原理 2.7、3.2，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/16`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
