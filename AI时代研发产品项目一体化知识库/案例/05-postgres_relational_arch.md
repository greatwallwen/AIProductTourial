# 实操 05：系统架构｜关系库查询(PostgreSQL)

### 项目场景故事

数据工程师要把 14 万行真实空气监测（北京 12 国控站逐时 PM2.5/PM10/气温）落成可秒查的关系库：真建表、真按站点/月份聚合、真 EXPLAIN。重点不是查出什么，而是让「规模/索引/执行计划」在真大表上可观测——无索引全表扫 vs 复合索引走索引，一眼分明。

> **本案例演示/验证**：原理 3.3、4.1｜**采用设计** `steel-queue`（见 [design/steel-queue.md](../../design/steel-queue.md)）

> **在数字化系统中的位置**：底座平台层 · 治理环节｜**理论→实操**：把原理 3.3、4.1 落成可运行操作：用真实 SQL（建表/索引/参数化聚合）支撑经营分析，讲清 PostgreSQL 架构（数字化底座本身）

> **角色镜头**：<img src="../../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> 研发（本案更偏这些角色；主脊 §1-§2 三镜头共读）

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 高阶｜**一句话** 经营数据关系库查询：把真实订单用真实 SQL（建表/索引/参数化聚合）支撑经营分析｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：关系库不是「存下来」就行，而是「查得动」。本案换成真实大表——UCI 北京 12 国控站空气质量 14 万行逐时监测（CC BY 4.0）：node:sqlite 真建表、按站点/月份真聚合平均 PM2.5、EXPLAIN 看真实执行计划。核心可观测证据：同一条 WHERE station=? 查询，无索引 SCAN 全表（14 万行），建 (站点,时间) 复合索引后 SEARCH USING INDEX——「规模」不是口号。生产换 PostgreSQL 架构一致，CROSS JOIN 可再演到千万级。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：① 无索引全表扫描，数据一大就慢；② 拼字符串 SQL 有注入风险（本案参数化）；③ 把本地 SQLite 演示当生产 PG，忽略连接池/分区/备份。

**现状问题**

- 决策依赖的关键指标：表行数、站点数、平均PM2.5、平均气温。
- 现场常见异常：。
- 只做通用页面无法支撑「用真实 SQL（建表/索引/参数化聚合）支撑经营分析，讲清 PostgreSQL 架构」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `capstone-product-flow` 与 `evidence-pack` 完成分析，产出 `关系库查询与 PG 架构说明`，用 `traceability-check` 验收。

### 任务目标与数据

- 行业：数据工程
- 真实业务场景：北京空气质量大表·查询优化与复合索引
- 岗位：数据产品经理
- 数据或资料：`dataset/real/beijing_air_quality.csv`（140256 行，异常 10）
- 公开参考：https://www.postgresql.org/docs/current/ ｜ 数据：UCI Online Retail II（CC BY 4.0）
- 行业字段：站点、时、PM2.5、PM10、气温
- 指标链（真实基座 + 已标注教学合成叠加列）：表行数 140256，站点数 12，平均PM2.5 78.11，平均气温 13.52
- 决策动作：用真实 SQL（建表/索引/参数化聚合）支撑经营分析，讲清 PostgreSQL 架构
- 风险边界：本地 SQLite 演示、生产为 PostgreSQL；不得把演示数据当真账
- UI 原型：`ui_45_pg_relational`（db_console）
- 采用设计：steel-queue
- SaaS 组件：表结构、SQL 查询、结果表、区域聚合、执行说明

### Prompt 实操

> **怎么用**：推荐用 **CodeBuddy 的 Plan 模式**（腾讯，国产·当下可跑）——把下面灰底代码框**整段原样粘进去，它会先列出任务清单、再自主执行**，你不需要看懂里面的技术细节；没装过就先装一个。海外读者用 Claude Code / Cursor / Trae 等任一 Agent 工具同理（见附录B）。

**Prompt 1：北京空气质量大表·查询优化与复合索引 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「北京空气质量大表·查询优化与复合索引」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：数据产品经理 面向「北京空气质量大表·查询优化与复合索引」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `dataset/real/beijing_air_quality.csv`，只使用其中实际存在的字段（站点、时、PM2.5、PM10、气温）。
- 指标链：表行数、站点数、平均PM2.5、平均气温（当前真实值：表行数=140256，站点数=12，平均PM2.5=78.11，平均气温=13.52）。
- 现场异常：要盯的是 ——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——用真实 SQL（建表/索引/参数化聚合）支撑经营分析，讲清 PostgreSQL 架构
- 使用 Skill：用 capstone-product-flow、evidence-pack 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：关系库查询与 PG 架构说明，保存为 `outputs/product_case_library/case_05_postgres_relational_arch_问题定义.md`。
- 边界：结论必须回到数据或公开参考（https://www.postgresql.org/docs/current/ ｜ 数据：UCI Online Retail II（CC BY 4.0））；不得越过「本地 SQLite 演示、生产为 PostgreSQL；不得把演示数据当真账」。
```

**Prompt 2：北京空气质量大表·查询优化与复合索引 - 方案验收**（注意：outputs/ 交付物由 build_docs 重建覆盖，建议在新分支/对照目录运行）

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「北京空气质量大表·查询优化与复合索引」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `dataset/real/beijing_air_quality.csv`，只使用其中实际存在的字段（站点、时、PM2.5、PM10、气温）。
- 指标链：表行数、站点数、平均PM2.5、平均气温（当前真实值：表行数=140256，站点数=12，平均PM2.5=78.11，平均气温=13.52）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/05`，按 `ui_45_pg_relational`（db_console）与设计 `steel-queue` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 traceability-check 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：关系库查询与 PG 架构说明，保存为 `outputs/product_case_library/case_05_postgres_relational_arch_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「本地 SQLite 演示、生产为 PostgreSQL；不得把演示数据当真账」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![北京空气质量大表·查询优化与复合索引 · 信息图](../../outputs/product_case_library/svg/case_05_postgres_relational_arch.svg)

![北京空气质量大表·查询优化与复合索引 · 可运行大屏原型截图](../../assets/screenshots/premium_case_05_postgres_relational_arch_desktop.png)

- 图形类型：postgres_relational_arch（设计 steel-queue）
- 看图顺序：先看真实表结构，再按区域(真实国家)聚合真实销售额，最后想千万级表该加什么索引。
- UI 差异：本案例采用 `ui_45_pg_relational` + 设计 `steel-queue`，不得复用通用表格占位；可运行原型见 `#/case/05`。

### 交付物与验收

交付物：**关系库查询与 PG 架构说明**。必含要素（字段/指标链/异常状态/Skill/决策动作/高影响复核）与合格线由自测器六项核对：`node code/tools/check_my_work.mjs 5 你的方案.md`；红线：不越过「本地 SQLite 演示、生产为 PostgreSQL；不得把演示数据当真账」。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/05`（本案专属大屏）。
2. **你应看到**：SQL 语句、执行结果表与索引说明，数据来自后端实时接口（性质见章首标注）。
3. **动手改一改**：打开页面切「站点/月份」聚合看真 SQL 回显；再看「加索引前/后」面板：同一条 WHERE station=? 查询如何从 SCAN 全表变 SEARCH USING INDEX；想一想若加 WHERE station=? AND ts BETWEEN ...，(站点,时间) 复合索引列序怎么排。
4. **自测产出**：`node code/tools/check_my_work.mjs 5 你的方案.md`——红项指明缺什么、回哪章补。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

为什么「存下来」≠「查得动」？页面「加索引前/后」面板给真实证据：14 万行 air_quality 无索引时 EXPLAIN=SCAN air_quality，建 (station,ts) 复合索引后=SEARCH USING INDEX。深挖：复合索引列序（等值列 station 在前、范围列 ts 在后）、覆盖索引避免回表、连接池、EXPLAIN ANALYZE 看真实行数与代价、真实数据的 NA 缺口（本表 PM2.5 有缺口，均值须剔 NULL）。失效模式：拿本地小表「秒出」推断生产 PG 千万行性能——量级与引擎都不同。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：在 `#/case/05` 里按区域聚合销售额，说出金额最高的区域。
2. **挑战**：这张 orders 表涨到千万级会慢在哪？你会加什么索引、为什么本地 SQLite 演示不能等同于生产 PostgreSQL？

<details>
<summary>参考思路（先自己想，再展开）</summary>

- 这两题没有唯一标准答案，检验的是你能否把本案方法用自己的话讲出来：先按「跟着做」第 3 步真改一次、看指标怎么动，再对照上方「深度」折叠块的权衡与失效模式自评你的答案有没有踩坑。
- 答不顺就回读本案演示的原理小节 §3.3、§4.1；写成方案后跑 `node code/tools/check_my_work.mjs 5 你的方案.md`，红项会指明缺什么、回哪章补。
</details>

### 被追问（grill-me · 先自己答，再展开）

> 教员式追问：不给你标准答案，先逼你选、再点破误区。页内 `#/case/05` 有可交互版（答错即追问）。

**追问 1**：本地 SQLite 演示按区域聚合秒出，生产那张千万行 orders 表性能也不用担心吧？

- A. 不用，架构一样
- B. 要担心，缺复合索引会全表扫描
- C. 换更强的机器就行

<details>
<summary>点破（先选再展开）</summary>

- 若选「不用，架构一样」：架构一致不代表查得动——缺 (区域,日期) 复合索引，千万行就全表扫描（EXPLAIN 面板里 SCAN vs SEARCH USING INDEX 一眼可见）。
- 若选「换更强的机器就行」：加机器治标；根因是没走索引，且 SQLite≠生产 PG（连接池/分区/备份）。先看 EXPLAIN 有没有 SEARCH USING INDEX。
- 答对后再想一层：对。第二问：EXPLAIN 里看到 SCAN 全表，第一步该做什么？
</details>

**追问 2**：EXPLAIN QUERY PLAN 显示 SCAN orders（全表扫描），最该先做的是？

- A. 加机器
- B. 加合适的复合索引，再看是否变 SEARCH USING INDEX
- C. 把表拆小

<details>
<summary>点破（先选再展开）</summary>

- 若选「加机器」：加机器不解决全表扫描——CPU 再强也得逐行扫。先让查询走索引。
- 若选「把表拆小」：拆表是重活且未必需要；先加复合索引看 EXPLAIN 是否转 SEARCH USING INDEX。
- 答对后再想一层：对。「存下来」不等于「查得动」，索引才是关键。
</details>

> **所以真正的一课**：演示数据量小掩盖了性能问题；生产靠 EXPLAIN 读执行计划、用复合索引把 SCAN 变 SEARCH USING INDEX——存得下≠查得动，且 SQLite≠生产 PG。

> **小结**：本案用「北京空气质量大表·查询优化与复合索引」演示原理 3.3、4.1，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/05`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
