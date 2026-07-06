# 系统建造编排器 · prompt 模板（把一次中大型建造分而治之）

单个 maker/checker Loop（见 `loop.orchestrator.md`）只解决**一个任务**，且 `stop-rules.md` 第 5 条会在「任务过大」时叫停并要求拆分——但没说怎么拆、怎么排。本模板补上这一层：**把一个中大型系统的建造，按规格驱动（SDD）分解成许多个可独立收敛的小 Loop，再集成、过门禁。** 工具无关。

## 步骤

0. **对齐宪法与规格**：先读 `rules/`（宪法，不可谈判的约束）；把「要什么/为什么」写成 `spec.md`（用 skill `spec-authoring`）。规格是唯一真源。
1. **澄清**：把 `spec.md` 里所有模糊处标 `[需澄清]`，**逐条问人确认**（skill `requirement-clarify`）——人在关口，消除意图债务，不许替人猜。
2. **架构设计**：产出 `plan.md`——C4 四层图（skill `c4-modeling`）、DDD 限界上下文（skill `domain-decomposition`）、关键选型的 ADR（skill `adr-authoring`）、质量属性场景（skill `quality-attribute-scenario`）。
3. **按限界上下文分解子系统**：每个子系统一份「子简报」（目标/边界/接口契约/验收标准）。子系统之间**只经接口契约**对接（skill `interface-contract`），契约即代码（OpenAPI 自动生成）。
4. **任务分解**：把每个子系统再拆成原子、可并行、可独立验收的任务（skill `task-decomposition`），标注依赖，形成一张任务 DAG。
5. **逐任务跑单 Loop**：对无依赖或依赖已完成的任务，各起一个 maker/checker Loop（`loop.orchestrator.md`）跑到 all-green；可并行的任务并行跑。**任一子任务卡住两轮，按 `stop-rules.md` 停下、升级到人**，不硬刚。
6. **集成契约测试**：子系统合起来时，跑跨子系统的契约/集成测试（用适应度函数 skill `fitness-function` 检测越界与循环依赖），而非只看单元测试。
7. **整体门禁**：一致性检查 + evals + `verify` 三绿（§6）；架构评审（skill `arch-review`，只读）核查工件一致性与覆盖缺口。**任一红灯，回到对应步骤，不放行**。
8. **演进**：上线后按「演进触发表」观察信号；有信号回去改 `spec.md`（真源），而非直接补丁代码。

## 红线

- **不跳澄清、不跳门禁**：这两步一个防意图债务、一个防上线才炸，是分而治之能收敛的前提。
- **子系统之间只经契约**：不许一个子系统直接读另一个的内部状态（Bezos API Mandate，§3.4）。
- **maker ≠ checker**：每个子任务的实现者与验收者相互独立（`checker.role.md` 只读隔离）。
- **一次只推进依赖就绪的任务**：DAG 上游未绿，不启动下游，避免返工雪崩。
