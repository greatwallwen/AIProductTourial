# 实操 47：数据指标｜三维经营散点(three.js)

> **本案例演示/验证**：原理 3.3、5.1｜**采用设计** `graphite-hud`（见 [design/graphite-hud.md](../../design/graphite-hud.md)）

> **在数字化系统中的位置**：底座平台层 · 洞察环节｜**理论→实操**：把原理 3.3、5.1 落成可运行操作：用 three.js/R3F 把经营数据渲染成可交互三维散点，暴露多维离群（数字化底座本身）

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 进阶｜**一句话** 经营三维散点：把真实订单数据渲染成可交互三维散点，暴露多维离群｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：三维散点的价值是「一眼看出多维离群」：本案把真实订单的单价×数量×金额三维铺开，孤立的高价低量点、以及真实退货的负数量点在二维图里会被掩盖，三维一转就现形。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：常见坑：① 为炫技上三维，二维能说清就别用；② 三维当统计结论（它是探索工具）；③ 无 WebGL 环境不做退化，页面空白（本案退化等距投影）。

### 项目场景故事

可视化产品经理用 react-three-fiber 把真实经营数据（UCI Online Retail II 的单价×数量×金额，色=品类）渲染成真实三维散点（后端 /api/points3d 供点），在大屏上交互探索多维离群（含真实退货带来的负数量点）。

**现状问题**

- 决策依赖的关键指标：数据点数、品类数、最大金额(元)、客单价均值(元)。
- 现场常见异常：离群点、空品类。
- 只做通用页面无法支撑「用 three.js/R3F 把经营数据渲染成可交互三维散点，暴露多维离群」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `capstone-product-flow` 与 `evidence-pack` 完成分析，产出 `三维散点可视化方案`，用 `traceability-check` 验收。

### 任务目标与数据

- 行业：数据可视化
- 真实业务场景：经营三维散点可视化
- 岗位：可视化产品经理
- 数据或资料：`dataset/order_data.csv`（4500 行，异常 500）
- 公开参考：React Three Fiber https://github.com/pmndrs/react-three-fiber
- 行业字段：品类、单价、数量、金额
- 指标链（真实值）：数据点数 4500，品类数 10，最大金额(元) 1374，客单价均值(元) 5.72
- 决策动作：用 three.js/R3F 把经营数据渲染成可交互三维散点，暴露多维离群
- 风险边界：三维仅作探索，不替代统计结论
- UI 原型：`ui_47_three_scatter`（scene_3d）
- 采用设计：graphite-hud
- SaaS 组件：三维散点、坐标轴、品类图例、离群标记、轨道控制

### Prompt 实操

**Prompt 1：经营三维散点可视化 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「经营三维散点可视化」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：可视化产品经理 面向「经营三维散点可视化」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/order_data.csv`，只使用其中真实存在的字段（品类、单价、数量、金额）。
- 指标链：数据点数、品类数、最大金额(元)、客单价均值(元)（当前真实值：数据点数=4500，品类数=10，最大金额(元)=1374，客单价均值(元)=5.72）。
- 现场异常：要盯的是 离群点、空品类——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——用 three.js/R3F 把经营数据渲染成可交互三维散点，暴露多维离群
- 使用 Skill：用 capstone-product-flow、evidence-pack 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：三维散点可视化方案，保存为 `outputs/product_case_library/case_47_three_d_scatter_问题定义.md`。
- 边界：结论必须回到数据或公开参考（React Three Fiber https://github.com/pmndrs/react-three-fiber）；不得越过「三维仅作探索，不替代统计结论」。
```

**Prompt 2：经营三维散点可视化 - 方案验收**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「经营三维散点可视化」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/order_data.csv`，只使用其中真实存在的字段（品类、单价、数量、金额）。
- 指标链：数据点数、品类数、最大金额(元)、客单价均值(元)（当前真实值：数据点数=4500，品类数=10，最大金额(元)=1374，客单价均值(元)=5.72）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/47`，按 `ui_47_three_scatter`（scene_3d）与设计 `graphite-hud` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 traceability-check 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：三维散点可视化方案，保存为 `outputs/product_case_library/case_47_three_d_scatter_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「三维仅作探索，不替代统计结论」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![经营三维散点可视化 · 信息图](../../outputs/product_case_library/svg/case_47_three_d_scatter.svg)

![经营三维散点可视化 · 可运行大屏原型截图](../../assets/screenshots/premium_case_47_three_d_scatter_desktop.png)

- 图形类型：three_d_scatter（设计 graphite-hud）
- 看图顺序：先转动三维散点找「高单价低数量」离群点，再看真实退货的负数量点，最后想三维何时比二维更有用。
- UI 差异：本案例采用 `ui_47_three_scatter` + 设计 `graphite-hud`，不得复用通用表格占位；可运行原型见 `#/case/47`。

### 交付物与验收

- 交付物：三维散点可视化方案
- 必含字段：品类、单价、数量、金额
- 必含指标链：数据点数、品类数、最大金额(元)、客单价均值(元)
- 必含异常状态：离群点、空品类
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。
- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「三维仅作探索，不替代统计结论」。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/47`（本案专属大屏）。
2. **你应看到**：指标链（数据点数 / 品类数 / 最大金额(元) …）、异常队列与责任对象、行动入口，数据全部来自真实后端实时计算。
3. **动手改一改**：找一个二维会掩盖、三维才现形的离群点；再举一个「三维只是炫技」的反例。

### 练习（做完再进下一个案例）

1. **巩固**：在 `#/case/47` 转动三维散点，找一个「高单价、低数量」的离群点。
2. **挑战**：什么情况下三维散点比二维更有用？什么情况下它只是炫技？各举一个具体例子。

> **小结**：本案用「经营三维散点可视化」演示原理 3.3、5.1，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/47`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
