# 数据可视化 Skill 库

每个 Skill 六槽结构化（触发条件/输入/澄清问题/PRD 片段/验收标准/复用范围），发布前经 `skill_lint.mjs` 扫描。三个 Skill 本质相同——把数据/结构可视化成图表，只是数据类型不同：lieflat-charts 可视化统计数据，drawio-skill 可视化系统架构，Archify 可视化案例流程动态。开源工具克隆到 `skills/<name>-main/` 方便离线使用，课程保留实际采用的触发条件、输入输出、许可和测试。

共 3 个 Skill（核实 2026-08）。

## lieflat-charts

- 类型：构建型
- 触发条件：当需要把统计数据做成有编辑感、能阅读、能组成完整页面的单色 HTML 图表时
- 输入：数据 + 场合/读者（写作者、运营、做 PPT 的人）
- 澄清问题：数据形状是什么（比较/序列/占比/分布）？有几个独立结论？读者是非程序员吗？
- PRD 片段：从仓库模板生成单文件 HTML 图表——先判数据形状，再审计 Lupi Editorial（L1–L15）与 Lupi Basics（F1–F12）候选，Glance（G1–G18）是降级方案不是并列首选；默认 Mono 灰阶（纸灰 #F0EFEB + 炭黑 #1C1C1A），明度即数据，柱状图不断轴，确定性伪随机 `rnd(i,k)` 禁用 `Math.random()`；标题写结论不写图型名（来源：larashero3-dotcom/lieflat-charts，克隆至 `skills/lieflat-charts-main/`，核实 2026-08）
- 验收标准：从仓库模板生成非另画、沿用模板代码骨架、默认 Mono 灰阶、柱状图不断轴、刷新数据长一样
- 复用范围：B02 单色统计图表

## drawio-skill

- 类型：构建型
- 触发条件：当需要画架构图/流程图/ER图/UML/C4 等精确、可导出 PNG/SVG/PDF 的可编辑图表时
- 输入：图表类型 + 系统描述/代码/IaC/API spec
- 澄清问题：什么图型（C4/ERD/UML/BPMN/网络拓扑）？需要自定义样式或品牌图标吗？导出什么格式？要嵌入可编辑 XML 吗？
- PRD 片段：生成 `.drawio` XML 并用 draw.io desktop CLI 导出 PNG/SVG/PDF/JPG——支持 31 个脚本（导入 Python/JS/Go/Rust 代码、Terraform/K8s/docker-compose IaC、OpenAPI spec、实时 infra 快照、C4 多页钻取、diff/timelapse、relabel/restyle）；`c4.py` 生成多页 C4 带 click-to-drill-down；`validate.py` 做结构 lint（悬空边/重复 id/重叠）；视觉自检需 vision 模型（来源：Agents365-ai/drawio-skill，MIT，5.4k star，克隆至 `skills/drawio-skill-main/`，核实 2026-08）
- 验收标准：`.drawio` 可编辑、导出格式正确、`validate.py` 无悬空边/重复 id、视觉自检通过
- 复用范围：B20 C4 四层架构图

## archify

- 类型：构建型
- 触发条件：当需要把系统架构/工作流/时序/数据流/生命周期做成可交互的独立 HTML 图、可选 trace 动画时
- 输入：场景描述或 Mermaid（flowchart/sequenceDiagram/stateDiagram）
- 澄清问题：什么图型（architecture/workflow/sequence/dataflow/lifecycle）？需要动态演示还是静态？暗色还是亮色？
- PRD 片段：从小型 JSON IR 生成自包含交互 HTML——内联 SVG、暗/亮主题、可选 trace 动画、导出 PNG/JPEG/WebP/SVG/WebM；先写候选再 validate，showcase 级需 9 项 artifact 检查 0 错误 0 警告；`deliver` 冻结规格字节快照、SHA-256 留痕；一条主路径 + 短侧支，至多 12 主节点（来源：tt-a1i/archify，MIT，v2.13.0，基于 Cocoon-AI/architecture-diagram-generator，克隆至 `skills/archify-main/`，核实 2026-08）
- 验收标准：`validate` 通过 9 项 artifact 检查 0 错误 0 警告、`deliver` 冻结规格并报 SHA-256、边不穿越无关节点
- 复用范围：S09 案例动态架构图
