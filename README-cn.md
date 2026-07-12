# 会自检的 AI 工程 · 实操手册

一句话：**教你从「亲自干活」升级到「设计一个能自动干活、还能自我检查的系统」**。这套系统有三个零件——**Loop**（让 AI 循环干活的流水线）、**Skills**（把你的判断沉淀成可复用的技能包）、**验证 / evals**（拿一组测试题给 AI 打分，再加人在关键处把关）。**本书只做这一个承诺——教你设计会自检的 Loop 系统**：不教提示词小技巧、不教求职、不按角色切三份；研发/产品/项目背景都能读，但主线只有一条。**整体逻辑：先讲 AI 底层与系统设计的理念、原理、工程规范与多套设计，再用真实案例演示、验证**。教程为按章多文件目录 [`AI时代研发产品项目一体化知识库/`](AI时代研发产品项目一体化知识库/README.md)（README 为总目录导读，每章可独立精修）。

## 教程结构（多文件，按章）

- **第一部分 · 理念与原理**：`1.` **AI 核心概念底层**（LLM/Token/Context/Prompt/Tool/MCP/Agent/Skill，备注按科普叙事写，易懂）；`2.` 会 Loop 的产品工程（三层 Loop / 控制论 / 四框架 Superpowers·GSD·GStack·Trellis——**这些英文名是第 2 章才展开的方法，这里先扫一眼、不必懂**）；`3.` 系统架构设计（产品视角）；`4.` 工程规范（`rules/`）；`5.` 多套设计系统（`design/`）。每节配 `备注` 与专业级 SVG。
- **第二部分 · 数字化系统全景 + 案例**：先一张**全景图把 9 案例串成一个数字化系统**（纵向三层 底座/能力/应用 × 横向数据价值闭环 采集→治理→洞察→决策→执行→验收→增长；04/05/06=底座），每案例标注 演示原理 + 采用设计 + **在系统中的位置 + 它是哪条理论的实操**；做到 真数据 → 真后端 → 可运行原型 → 真截图 → 交付物 → 可校验。

## HTML 讲师长课

本仓库同时作为 HTML 授课平台的课程素材源。讲师版采用 **3 天、9 个连续单元、18 小时、学员只观看、数据离线分发** 的合同；A03 贯穿全课，A01/A02/55/56/57 分别证明大文件边界、多表契约、泄漏红线、不平衡评测和运行治理。课程映射、删冗余原则、演示协议与图形边界见 [HTML 讲师长课映射](docs/HTML_INSTRUCTOR_COURSE.md)。

概念和产品原型统一收口到 [`assets/image2/`](assets/image2/README.md)。image2 图只负责解释概念和界面方向，**永远不产生 live/verified 状态**；精确拓扑继续由代码生成 SVG 表达，运行结果继续由真实页面截图和结构化回执证明。

## 产品级 workbench（`code/`，一服务串起全部）

`bash code/run.sh` 起一个 Fastify+node:sqlite 服务（托管 API + 前端），含：**首页数字化系统全景**（可点节点进案例）+ 学习路径、**AI 概念实验室**（Tokenizer 实时分词 / Context Window 可视化 / RAG Playground / ReAct 智能体游戏，后端真实驱动）、9 案例、**案例↔原理双向溯源**（原理索引）、**在线 API 文档**（/api/openapi.json）、**亮/暗主题**、全站搜索、a11y。

## 目录结构

| 目录 | 内容 |
|---|---|
| `design/` | ≥5 套**各不相同**的深色大屏设计系统（`themes.json` 单一来源令牌 + `*.md` 人读文档），案例分设计 → 风格各异 |
| `rules/` | 工程规范（AI 约束 / 前端 Monorepo·微前端 / 后端分层），对齐 Google/OWASP/Conventional Commits 等并注来源 |
| `skills/` | `pm_skills.md`（28 结构化 Skill）+ `loop_engineering/`（builder/checker/loop/停机规则/记忆区）+ `skill_lint.mjs` 扫描器（§6 skill 治理 dogfood） |
| `dataset/` | 各案例数据 + `MANIFEST.md`（真实/教学合成显式标注） |
| `code/web/` | Vite + React + TS 深色大屏工作台，一案例一路由 `#/case/NN`，按 design 主题化 |
| `code/tools/*.mjs` | 数据生成/预计算/manifest/设计/skills/文档/校验（单文件均 < 800 行） |
| `outputs/product_case_library/` | manifest + 9 案例 SVG + 18 交付物 md | `assets/screenshots/` | 9 张深色大屏截图 |

## 快速开始

**第 0 步 · 环境准备（没装过 Node 的先看这步）**：本项目要 **Node ≥ 22**（用到实验性 `node:sqlite`）。没装过就去 [nodejs.org](https://nodejs.org) 下 22 版，装完在终端跑 `node -v`，看到 `v22`（或更高）才继续。

```bash
# ① 生成数据 + 文档（第一次只需跑这一整行）
node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs && node code/tools/build_docs.mjs
# ② 起服务：终端会打印 http://localhost:5200 —— 浏览器打开这个地址就是首页
bash code/run.sh
# ③ 校验（可选）：全绿代表交付完整
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
