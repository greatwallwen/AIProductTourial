# 实操 44：AI协作｜知识库语义检索(RAG)

> **本案例演示/验证**：原理 1.3、3.3｜**采用设计** `emerald-flow`（见 [design/emerald-flow.md](../../design/emerald-flow.md)）

> **在数字化系统中的位置**：底座平台层 · 治理环节｜**理论→实操**：把原理 1.3、3.3 落成可运行操作：用真实向量检索为问答/推荐提供高相关片段，替代全量塞入（数字化底座本身）

> <img src="../../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **难度** 高阶｜**一句话** 产品知识库语义检索：用真实向量检索为问答/推荐提供高相关片段，替代全量塞入｜**前置** 建议先读完第一部分
>
> <img src="../../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **洞见**：RAG 的价值不在「能检索」，而在「只召回最相关的几段」——本案真做了两阶段：cosine 粗召回 top-10 → Cross-Encoder 精排 top-3，把 194 篇语料压到 3 段喂给模型，降本又聚焦。
>
> <img src="../../assets/vendor/lucide/built/alert-triangle.svg" width="14" alt="" style="vertical-align:-2px" /> **常见坑**：常见坑：① 只召回不重排，相关度不够；② 把低相似片段当事实回答；③ 语料不切分/不更新，检索质量随时间劣化。

### 项目场景故事

AI 产品经理要把上千页产品知识做成语义检索：不是全量塞入大模型，而是用向量库只召回与问题高相关的片段（对应 §1.3 上下文/RAG）。前端调 /api/search 实时展示命中与相似度。

**现状问题**

- 决策依赖的关键指标：语料篇数、语料总字(万)、平均篇幅(字)、覆盖主题数。
- 现场常见异常：低相似、无命中、越权语料。
- 只做通用页面无法支撑「用真实向量检索为问答/推荐提供高相关片段，替代全量塞入」。

**本次任务**

- 明确岗位、指标链、异常状态与决策动作。
- 使用 `capstone-product-flow` 与 `evidence-pack` 完成分析，产出 `RAG 检索方案与验收`，用 `traceability-check` 验收。

### 任务目标与数据

- 行业：AI 应用
- 真实业务场景：产品知识库语义检索
- 岗位：AI 产品经理
- 数据或资料：`skills/external/pm-skills-deanpeters/README.md`（194 行，异常 0）
- 公开参考：本地：skills/external/pm-skills-deanpeters（RAG 语料）｜pgvector github.com/pgvector/pgvector
- 行业字段：查询、命中文档、相似度、片段
- 指标链（真实值）：语料篇数 194，语料总字(万) 191，平均篇幅(字) 9838，覆盖主题数 8
- 决策动作：用真实向量检索为问答/推荐提供高相关片段，替代全量塞入
- 风险边界：不得把低相似片段当作事实回答
- UI 原型：`ui_44_rag_retrieval`（rag_search）
- 采用设计：emerald-flow
- SaaS 组件：查询框、命中列表、相似度条、片段预览、语料统计

### Prompt 实操

**Prompt 1：产品知识库语义检索 - 问题定义**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「产品知识库语义检索」的**产品问题定义**（这一步先把问题想清楚，不写代码）：
- 岗位与场景：AI 产品经理 面向「产品知识库语义检索」，把业务判断转成一份可验证的产品问题定义。
- 数据：读取 `skills/external/pm-skills-deanpeters/README.md`，只使用其中真实存在的字段（查询、命中文档、相似度、片段）。
- 指标链：语料篇数、语料总字(万)、平均篇幅(字)、覆盖主题数（当前真实值：语料篇数=194，语料总字(万)=191，平均篇幅(字)=9838，覆盖主题数=8）。
- 现场异常：要盯的是 低相似、无命中、越权语料——说清每类异常谁负责、如何被发现。
- 决策动作：这份定义最终要支撑的关键决策是——用真实向量检索为问答/推荐提供高相关片段，替代全量塞入
- 使用 Skill：用 capstone-product-flow、evidence-pack 完成分析（结构化 Skill 见 skills/pm_skills.md）。
- 输出：RAG 检索方案与验收，保存为 `outputs/product_case_library/case_44_rag_knowledge_retrieval_问题定义.md`。
- 边界：结论必须回到数据或公开参考（本地：skills/external/pm-skills-deanpeters（RAG 语料）｜pgvector github.com/pgvector/pgvector）；不得越过「不得把低相似片段当作事实回答」。
```

**Prompt 2：产品知识库语义检索 - 方案验收**

```text
请以产品经理身份，用 AI 编程工具（如 Trae、CodeBuddy 等任一 Agent 工具）完成「产品知识库语义检索」的**方案验收**（把上一步的问题定义做成可运行原型，并逐项验收）：
- 目标：基于问题定义，产出一个可运行的深色大屏原型，让指标链、异常队列、责任、行动都能在页面上看到、点得动。
- 数据：读取 `skills/external/pm-skills-deanpeters/README.md`，只使用其中真实存在的字段（查询、命中文档、相似度、片段）。
- 指标链：语料篇数、语料总字(万)、平均篇幅(字)、覆盖主题数（当前真实值：语料篇数=194，语料总字(万)=191，平均篇幅(字)=9838，覆盖主题数=8）。
- 原型（技术契约，遵 rules/ 约束：DRY、单文件<800行、TS 类型、中文注释）：在 `code/web`（Vite+React+TS）路由 `#/case/44`，按 `ui_44_rag_retrieval`（rag_search）与设计 `emerald-flow` 渲染；数据经 `build_case_data.mjs` 预计算，不得复用通用表格占位。
- 使用 Skill：用 traceability-check 做验收（结构化 Skill 见 skills/pm_skills.md）。
- 输出：RAG 检索方案与验收，保存为 `outputs/product_case_library/case_44_rag_knowledge_retrieval_方案验收.md`。
- 验收条件：指标链回到真实数据、异常可追踪、行动入口明确；不得越过「不得把低相似片段当作事实回答」；`node code/tools/verify_course_package.mjs` 必须 ALL GREEN。
```

### 图形/原型/表单

![产品知识库语义检索 · 信息图](../../outputs/product_case_library/svg/case_44_rag_knowledge_retrieval.svg)

![产品知识库语义检索 · 可运行大屏原型截图](../../assets/screenshots/premium_case_44_rag_knowledge_retrieval_desktop.png)

- 图形类型：rag_knowledge_retrieval（设计 emerald-flow）
- 看图顺序：先输入一个产品问题看召回哪 3 段、相似度多少，再换近义词看命中变化，最后想两阶段召回的意义。
- UI 差异：本案例采用 `ui_44_rag_retrieval` + 设计 `emerald-flow`，不得复用通用表格占位；可运行原型见 `#/case/44`。

### 交付物与验收

- 交付物：RAG 检索方案与验收
- 必含字段：查询、命中文档、相似度、片段
- 必含指标链：语料篇数、语料总字(万)、平均篇幅(字)、覆盖主题数
- 必含异常状态：低相似、无命中、越权语料
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

- 合格标准：业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。
- 不合格标准：使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得把低相似片段当作事实回答」。

### 跟着做（动手复现）

1. 起服务：`bash code/run.sh`，浏览器打开 `#/case/44`（本案专属大屏）。
2. **你应看到**：指标链（语料篇数 / 语料总字(万) / 平均篇幅(字) …）、异常队列与责任对象、行动入口，数据全部来自真实后端实时计算。
3. **动手改一改**：换一个更口语的问法，看命中是否变差；想想若语料长期不更新，检索质量会怎样劣化。

<details>
<summary><img src="../../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> 深度（专业读者）：权衡 · 失效模式 · 何时别用</summary>

RAG 质量几乎由「切分 + 召回 + 重排」三步决定：切太碎丢上下文、切太大稀释相关度；向量召回 recall 高但 precision 低，所以两阶段——粗召回(cosine top-k)保 recall、精排(Cross-Encoder)提 precision。评估要同时看 recall@k 与 answer faithfulness：检索到了却仍幻觉，说明生成端没约束住。
</details>

### 练习（做完再进下一个案例）

1. **巩固**：打开 `#/lab/rag` 输入一个产品问题，看它召回哪 3 段、相似度多少；换一个近义词再试，命中变了吗？
2. **挑战**：为什么要「召回 10 → 重排 3」两阶段，而不是直接取相似度最高的 3 段？两种做法各会漏掉或引入什么？

> **小结**：本案用「产品知识库语义检索」演示原理 1.3、3.3，落成可运行、可验收的产品判断。运行 `bash code/run.sh` 后访问 `#/case/44`（真后端实时数据）。

[← 返回案例总览](README.md) · [返回目录](../../AI时代研发产品项目一体化知识库/README.md)
