# AI 时代 研发·产品·项目 一体化实操知识库

> **一个操作模型，三个角色镜头**——研发 · 产品 · 项目。真数据、可运行深色大屏原型、真截图、Node 自我校验护栏；数据真实/合成显式标注（[MANIFEST](../dataset/MANIFEST.md)）、高影响行业保留人工复核。安装 / 目录 / 运行见 [项目 README](../README.md)。

## 这本书讲什么

> **一句话**：AI 时代，你不再手动做每件事，而是**设计 Loop（自动运转的系统）、用 Skills、以验证/evals + 人在关口把关**。这套「操作模型」对 研发 / 产品 / 项目 三种角色是同一套；本书用它把三个角色统一起来，再用 14 个真实行业案例（含 3 个 dogfood：书自己测试/评测/门禁自己）演示、验证。
>
> **前置**：会用浏览器和命令行即可，无需先懂 AI 或会写代码。
>
> **读完你能**：看懂 AI 产品/系统的底层概念，掌握「设计 Loop → 用 Skills → 靠验证把关」这套跨角色操作模型，并能把 14 个真实行业案例跑起来、改起来。

### 统一操作模型（三个角色共享的脊柱）

过去你是「每件事都亲自跟 AI 对话」的人；现在你是「设计一个能自动跟 AI 对话、还能自己验收的系统」的人。这套系统就叫 **Loop**：设计 Loop、给它 **Skills**、用 **验证/evals** 产出「差多少」的误差信号、在**高影响处让人把关**。§1 讲底层概念、§2 把这套 Loop 讲透——它对下面三个角色是同一副骨架。

### 三个角色镜头（对号入座）

- <img src="../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> **研发镜头**：设计 **build / test / refactor** 的内层 Loop（分钟级）——让 Agent 自己写、自己跑测、自己纠错，你把关方向与质量。
- <img src="../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> **产品镜头**：设计 **discovery / eval / decision** 的中外层 Loop——把「值不值得做、做得好不好」量化成 evals，把判断落成可验收的产品动作。（本书原「产品经理转型」内容即这一镜头。）
- <img src="../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> **项目镜头**：设计 **delivery / governance** 的 Loop——L0→L3 分级上线、风险登记、责任分派、门禁与急停，把交付管住。

> 注：这是「**一个操作模型、三个镜头**」，不是「角色合并成一个」。业界两种声音都在——Andreessen / 吴恩达 / Atlassian 说角色在趋同（「人人都是 builder」）；a16z 则说 PM 是**补上 evals/技术判断以留在 PM**、专家深度不可全收编。诚实的结论：**操作模型在被标准化，角色仍是它上面各自的镜头**。

### 角色 × 能力矩阵（先对号入座）

| 能力层 | 一句话 | 研发 | 产品 | 项目 |
|---|---|:--:|:--:|:--:|
| L0 通用底座（问题定义/指标/用户/优先级/协作） | 三种角色的共同地基 | ● | ● | ● |
| L1 AI 认知（大模型/Token/上下文/RAG/Agent 边界） | 看懂 AI 能做/不能做/会怎么错 | ● | ● | ○ |
| L2 AI 产品化硬核（**评测 evals**/数据·提示词即规格/检索质量/成本-延迟权衡） | 把大模型做成可用产品的真功夫（**当前最缺**） | ● | ● | ○ |
| L3 AI 治理（安全红线/人工复核/合规/高影响边界） | 让 AI 不出事、出事能兜底 | ○ | ● | ● |
| L4 协作交付（Loop 开发模式/门禁/验收/可追溯） | 把判断落成能跑、能验收的东西 | ● | ○ | ● |

### 怎么真学会（不是看完就忘）

> 本书用一套经认知科学验证的学习法组织内容——你只要跟着做，就在用它。

- **知识 → 技能 → 智慧**：读章节 = 你「知道」；跟做案例 = 你「做到」；把方法用到自己真实项目 = 你「知道何时该做」。多数人停在「知道」，从没到「做到」——所以本书每章都配可运行的案例与练习。
- **流利度 ≠ 存储强度**：看完能复述，不代表学会了，那只是短期记忆；不训练很快蒸发。这就是为什么本书逼你**合上书回忆、隔几天再看、几种案例交错练**。
- 本书的练习不是摆设，是三种**「有效的费劲」**（认知科学 Robert Bjork「desirable difficulties」；开源实践见 Matt Pocock 的 `/teach` 技能，MIT）：**巩固题=检索练习**（合书凭记忆写）、**章节前置链=间隔**、**入门线/底座支线=交错**。
- **先写你的学习 MISSION**：别写「我想学好 AI」，写「学完后我能做 **Y**、改变 **Z**」（如「三个月内给我们产品的 AI 问答做一套 evals 上线」）。有了它，每章都能自问「这对我的 MISSION 有没有用」。

### 为什么现在学 · AI 时代的真实信号

- <img src="../assets/vendor/lucide/built/trending-up.svg" width="14" alt="" style="vertical-align:-2px" /> **岗位在爆发**：据脉脉高聘《2025 年度人才迁徙报告》（2025-12），**AI 产品经理岗位量同比增长 369.36%、在所有岗位中居首**（[新华网](http://www.news.cn/tech/20251215/db15c57301044b78b55b9d4c30a4e93b/c.html)）。
- <img src="../assets/vendor/lucide/built/flask-conical.svg" width="14" alt="" style="vertical-align:-2px" /> **技能在换代**：OpenAI 首席产品官 Kevin Weil 称「**写 evals（评测）正成为产品经理的核心技能，可能是最重要的一件事**」（[Lenny’s Newsletter](https://www.lennysnewsletter.com/p/kevin-weil-open-ai)）；吴恩达亦指出「严谨的 evals + 错误分析，是团队做 AI 智能体进展的最大预测因素」（[The Batch, 2025-10](https://www.deeplearning.ai/the-batch/improve-agentic-performance-with-evals-and-error-analysis-part-1)）。
- <img src="../assets/vendor/lucide/built/compass.svg" width="14" alt="" style="vertical-align:-2px" /> **角色在趋同又分化**：Marily Nika 把 AI PM 分为 AI 体验型 / 构建型 / 增强型（《The AI Product Playbook》）；更宏观地，工程/产品/项目正围绕「设计 Loop + evals」这套操作模型靠拢——但仍是各自的镜头（见上「三个角色镜头」的正反两说）。
- <img src="../assets/vendor/lucide/built/lightbulb.svg" width="14" alt="" style="vertical-align:-2px" /> **研究者也在「像 PM 一样思考」**：智能体研究者姚顺雨（ReAct、Tree of Thoughts 作者）2025 年底加入腾讯任**首席科学家**（注：科学家/研究负责人，非产品经理），提出「AI 从解题转向命题、评测比训练更重要」；微软 CPO Aparna Chennapragada 亦称「**提示词集正在成为新的 PRD**」。
- <img src="../assets/vendor/lucide/built/gauge.svg" width="14" alt="" style="vertical-align:-2px" /> **信息要核实**：这类开源「神器」常见极高 Star 数（十几万甚至更多）——Star 是**带日期的弱人气信号，不等于质量或权威**，用之前先核实、别被数字带节奏。这正是本书「evals / 验证」精神的日常版。

### 怎么读这本书（标记体系）

正文用三档标记，**新手只读必读也能走通全书，专业读者可循 选读 / 深度 直取深度**：

- <img src="../assets/vendor/lucide/built/check-circle.svg" width="14" alt="" style="vertical-align:-2px" /> **必读主线**：无论新手老手都该读，跳过会断链。
- <img src="../assets/vendor/lucide/built/book-open.svg" width="14" alt="" style="vertical-align:-2px" /> **选读·进阶**：深一层的原理或动手扩展，新手可先跳过、日后回看。
- <img src="../assets/vendor/lucide/built/sparkles.svg" width="14" alt="" style="vertical-align:-2px" /> **深度**：面向专业读者的权衡与延伸，不影响主线理解。
- **难度**：入门 / 进阶 / 高阶，标在每章每节与每个案例头部。
- 每章以「学习目标」开头、「本章小结 + 练习」收尾；练习答案放在可折叠块里——先自己想，再展开。
- <img src="../assets/vendor/lucide/built/book-marked.svg" width="14" alt="" style="vertical-align:-2px" /> **随时能查**：遇到不懂的词（Token / RAG / eval / 幻觉…），翻 [术语表](术语表.md)——一句话一个词。

### 学习路线图

| 章节 | 前置 | 难度 | 预计 | 谁该重点看 |
|---|---|---|---|---|
| [§1 AI 核心概念底层](01-AI核心概念底层.md) | 无 | 入门 | 20min | **所有人必读**，尤其非技术背景 |
| [§2 会 Loop 的工程](02-会Loop的工程.md) | §1 | 进阶 | 20min | 想懂 AI 开发模式的所有角色 |
| [§3 系统架构设计](03-系统架构设计.md) | §2 | 高阶 | 20min | 研发镜头；要和研发对话的产品/项目 |
| [§4 工程规范与约束](04-工程规范与约束.md) | 无 | 进阶 | 15min | 研发镜头；想判断「代码好坏」的人 |
| [§5 设计系统](05-设计系统.md) | 无 | 进阶 | 12min | 产品镜头；关注大屏/可视化的人 |
| [§6 交付治理](06-交付治理.md) | §2 | 进阶 | 15min | 项目镜头；管上线/门禁/风险的人 |
| [第二部分 · 11 案例](案例/README.md) | 第一部分 | 入门→高阶 | 每例 ~15min | 所有人，**边读边跑、动手验证** |

### 三条角色阅读路径（主脊必读，镜头按需）

- <img src="../assets/vendor/lucide/built/check-circle.svg" width="14" alt="" style="vertical-align:-2px" /> **共同主脊（所有人必读）**：§1 → §2。这是三个镜头共享的操作模型，跳过会断链。
- <img src="../assets/vendor/lucide/built/wrench.svg" width="14" alt="" style="vertical-align:-2px" /> **研发路径**：主脊 → §3 架构 → §4 工程规范 → 案例 45 关系库 / 46 架构契约 / 44 RAG / 47 三维。
- <img src="../assets/vendor/lucide/built/package.svg" width="14" alt="" style="vertical-align:-2px" /> **产品路径**：主脊 → §5 设计 → 案例 01 早会 → 16 医院 → 31 广告漏斗 → 30 RFM → 41 经营闭环。
- <img src="../assets/vendor/lucide/built/clipboard-list.svg" width="14" alt="" style="vertical-align:-2px" /> **项目路径**：主脊（尤其 §2 的 L0→L3 治理）→ §6 交付治理 → 案例 14 变更控制 → 28 规则/复核门禁。

### <img src="../assets/vendor/lucide/built/rocket.svg" width="14" alt="" style="vertical-align:-2px" /> 10 分钟先跑通（先见成品，再学原理）

先花 10 分钟把成品跑起来，有了全局直觉再回来学原理：

1. **环境**：Node ≥ 22（要用到实验性的 `node:sqlite`）。检查：`node -v`。
2. **一条命令起服务**：`bash code/run.sh`（Fastify + node:sqlite，一个服务同时托管后端 API 与前端）。
3. **你应看到**：终端打印 `… http://localhost:5200`；浏览器打开它 → 首页是「数字化系统全景」，点任一节点进入案例。
4. **先玩这三个**：`#/lab/tokenizer`（亲手把一句话分词）、`#/case/01`（电商早会经营台，最平缓的入门案例）、`#/game`（AI 概念配对小游戏）。

> 跑不起来？环境要求（Node ≥ 22）与常见报错排查见 [项目 README](../README.md)。

## 目录

**第一部分 · 共享操作模型与专业底子**

- [§1 AI 核心概念底层](01-AI核心概念底层.md) · [§2 会 Loop 的工程](02-会Loop的工程.md)（共享脊柱）
- [§3 系统架构设计](03-系统架构设计.md) · [§4 工程规范与约束](04-工程规范与约束.md)（研发底子）· [§5 设计系统](05-设计系统.md)（产品底子）· [§6 交付治理](06-交付治理.md)（项目底子）
- [术语表](术语表.md)

**第二部分 · 11 真实案例演示与验证**

- [案例总览 + 原理→案例反查](案例/README.md)
- [实操 01 · 电商早会异常订单台](案例/01-morning_ops_grid.md)
- [实操 14 · 航班准点运营调度](案例/14-logistics_change_control.md)
- [实操 16 · 医院急诊及时性运营](案例/16-hospital_capacity_scheduler.md)
- [实操 28 · 金融复核工作台](案例/28-finance_review_queue.md)
- [实操 30 · 航空会员价值运营](案例/30-airline_member_rfm.md)
- [实操 31 · 广告投放转化复盘](案例/31-ad_conversion_funnel.md)
- [实操 41 · 零售经营产品方案](案例/41-retail_capstone_board.md)
- [实操 44 · 产品知识库语义检索](案例/44-rag_knowledge_retrieval.md)
- [实操 45 · 经营数据关系库查询](案例/45-postgres_relational_arch.md)
- [实操 46 · 后端子系统分解与契约](案例/46-system_arch_flow.md)
- [实操 47 · 经营三维散点可视化](案例/47-three_d_scatter.md)
- [实操 48 · CI 失败分诊台](案例/48-ci_triage_loop.md)
- [实操 49 · RAG 回答评测台](案例/49-rag_eval_harness.md)
- [实操 50 · 交付门禁看板](案例/50-delivery_gates_board.md)

**收尾**

- [结课 · 自查 · 下一步](99-结课.md)

## 使用入口

- **统一运行/纠错约定**：`bash code/run.sh` 起一个服务（Fastify+node:sqlite 托管 API+前端），浏览器 `#/case/NN` 即真后端实时数据；遵 `rules/`（DRY / 单文件<800 行 / 类型 / 中文注释），`verify_course_package.mjs` 逐项核验。
- **目录结构、构建/运行、环境要求与常见报错排查**：见 [项目 README](../README.md) / [README-cn](../README-cn.md)。
