# 会自检的 AI 工程 · 实操手册

一句话：**教你从「亲自干活」升级到「设计一个能自动干活、还能自我检查的系统」**。课程围绕有边界的 **Loop**、可发现的 **Skills**、可授权的 **MCP**、真实 **evals** 与人工关口展开，不教提示词小技巧，也不把产品、研发、项目拆成三套重复内容。教程正文位于 [`AI时代研发产品项目一体化知识库/`](AI时代研发产品项目一体化知识库/README.md)，平台课程的单一事实源位于 [`course/`](course/README.md)。

## HTML-PPT 课程契约

- **6 个模块、12 项必做活动、720 分钟总学时，其中 495 分钟为实操（68.8%）**。
- 旧 9 案例重组为「数据到决策」「检索到评测」「规格到系统」三条纵向任务链；案例 02 保留为选修对照，不再复制九遍相同操作。
- 每项活动声明输入、typed runtime job、提交结构、证据对象和评分量规；结业要求不低于 80 分，并通过工程、产品、验证三角色复核。
- `outputs/html-ppt/ai-product-loop-course-package.json` 是 HTML-PPT 平台可导入包；学习过程状态与尝试记录由平台保存，不写回教程正文。

## 教程结构（多文件，按章）

- **第一部分 · 理念与原理**：`1.` AI 核心概念底层；`2.` 有边界、可停机的 Loop；`3.` 系统架构；`4.` 工程约束；`5.` 交付治理；`6.` 符合 Agent Skills 规范的 Skill 工程；`7.` MCP 生命周期、能力协商与安全边界。每节配讲师备注与 image2 优化图形。
- **第二部分 · 数字化系统全景 + 案例**：先一张**全景图把 9 案例串成一个数字化系统**（纵向三层 底座/能力/应用 × 横向数据价值闭环 采集→治理→洞察→决策→执行→验收→增长；04/05/06=底座），每案例标注 演示原理 + 采用设计 + **在系统中的位置 + 它是哪条理论的实操**；做到 真数据 → 真后端 → 可运行原型 → 真截图 → 交付物 → 可校验。

## 产品级 workbench（`code/`，一服务串起全部）

`bash code/run.sh` 起一个 Fastify+node:sqlite 服务（托管 API + 前端），含：**首页数字化系统全景**（可点节点进案例）+ 学习路径、**AI 概念实验室**（Tokenizer 实时分词 / Context Window 可视化 / RAG Playground / ReAct 智能体游戏，后端真实驱动）、9 案例、**案例↔原理双向溯源**（原理索引）、**在线 API 文档**（/api/openapi.json）、**亮/暗主题**、全站搜索、a11y。

## 目录结构

| 目录 | 内容 |
|---|---|
| `design/` | ≥5 套**各不相同**的深色大屏设计系统（`themes.json` 单一来源令牌 + `*.md` 人读文档），案例分设计 → 风格各异 |
| `rules/` | 工程规范（AI 约束 / 前端 Monorepo·微前端 / 后端分层），对齐 Google/OWASP/Conventional Commits 等并注来源 |
| `skills/` | `pm_skills.md`（28 结构化 Skill）+ `loop_engineering/`（builder/checker/loop/停机规则/记忆区）+ `skill_lint.mjs` 扫描器（§6 skill 治理 dogfood） |
| `course/` | 课程清单、12 项活动、三角色量规、数据边界、5 份纵向实验手册与可控 fixtures |
| `dataset/` | 各案例数据 + `MANIFEST.md`（真实/教学合成显式标注） |
| `code/web/` | Vite + React + TS 深色大屏工作台，一案例一路由 `#/case/NN`，按 design 主题化 |
| `code/labs/`、`code/tools/*.mjs` | Loop / Skill / MCP / 数据实验，以及课程生成、审计和校验工具 |
| `outputs/product_case_library/` | 可追溯 SVG 源图、9 案例定义与交付物 |
| `assets/course/image2/`、`assets/screenshots/` | 38 张 image2 图形、5 张概念图与 9 张真实界面截图 |

## 快速开始

**第 0 步 · 环境准备（没装过 Node 的先看这步）**：本项目要 **Node ≥ 22**（用到实验性 `node:sqlite`）。没装过就去 [nodejs.org](https://nodejs.org) 下 22 版，装完在终端跑 `node -v`，看到 `v22`（或更高）才继续。

```bash
# ① 生成数据 + 文档（第一次只需跑这一整行）
node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs && node code/tools/build_docs.mjs
# ② 生成并审计 HTML-PPT 课程包
node code/tools/audit_learning_course.mjs && node code/tools/build_html_ppt_course.mjs
node --test code/tools/course_contract.test.mjs code/tools/check_my_work.test.mjs
# ③ 起服务：终端会打印 http://localhost:5200 —— 浏览器打开这个地址就是首页
bash code/run.sh
# ④ 校验：全绿代表素材、课程契约与平台导入包一致
node code/tools/verify_course_package.mjs
```

## 环境与常见报错排查

- **Node ≥ 22**（用到实验性 `node:sqlite`）；`node -v` 确认。首次 `bash code/run.sh` 会装依赖+构建前端（约 1–2 分钟），正常打印监听地址 `http://localhost:5200`。
- `node:sqlite` 报错 / `SQLite is not defined` → Node 版本过低，升级到 ≥ 22（`nvm install 22 && nvm use 22`）。
- `EADDRINUSE :5200` → 端口被占用，关掉占用进程或改 `code/run.sh` 端口。
- 页面空白 / 接口 404 → 前端未构建或服务未起，确认 `bash code/run.sh` 打印了监听地址再刷新。
- `npm ci` 失败 → 到 `code/web`、`code/server` 分别 `npm install` 后重试。

## 质量红线

- **教程按章多文件目录**（早期「单一 md」红线已于 v11 反转）；**DESIGN.md 多套且各不相同**；**理念/原理在前、案例演示验证在后**。
- **Loop 模式工具无关**（理念/开发模式/skills/prompt）；具体工具链实操（gstack/OpenSpec/Superpowers/Ralph/Nacos 等）在 §2.6/§6 给真实命令（v13 起放开「不特写工具」红线，定位＝模式工具无关 + 真实工具链）。
- **代码约束**（DRY / 单文件 < 800 行 / 组件拆分 / 类型安全 / 中文"为什么"注释 / 错误处理 / 成熟方案优先 / 最小改动）既写进教程 `3.` 章又约束本仓库代码，`verify` 守护。
- 大屏**不同风格**、深色科技风、真实数字、信息密度高；高影响行业保留人工复核；真实/合成数据显式标注。

## 案例编号对照（v21 重编号）

v21 起案例统一重编号为 **01–09**（此前编号沿用更大的历史案例库，几经裁撤后号段不连续）。旧书签、旧链接、旧截图名可按下表对照；重编号前的完整旧状态锚定在 git 标签 `pre-renumber-v20`。

| 新号 | 案例 | 旧号 |
|---|---|---|
| 01 | 电商早会异常订单台 | 01（不变） |
| 02 | 航空会员价值运营（RFM） | 30 |
| 03 | 零售经营产品方案（综合闭环） | 41 |
| 04 | 知识库语义检索（RAG） | 44 |
| 05 | 关系库查询（PostgreSQL） | 45 |
| 06 | 子系统分解与接口契约 | 46 |
| 07 | RAG 评测台（eval harness） | 49 |
| 08 | SDD 系统建造走查 | 51 |
| 09 | 仓库事件总线（事件驱动） | 54 |
