# 数字化产品经理转型实操知识库

**AI 时代 研发·产品·项目 一体化实操知识库**——一个操作模型（设计 Loop · 用 Skills · 靠验证/evals + 人在关口把关），三个角色镜头（研发 / 产品 / 项目；「产品经理转型」是其中的产品镜头）。**整体逻辑：先讲 AI 底层与系统设计的理念、原理、工程规范与多套设计，再用真实案例演示、验证**。教程为按章多文件目录 [`AI时代研发产品项目一体化知识库/`](AI时代研发产品项目一体化知识库/README.md)（README 为总目录导读，每章可独立精修）。

## 教程结构（多文件，按章）

- **第一部分 · 理念与原理**：`1.` **AI 核心概念底层**（LLM/Token/Context/Prompt/Tool/MCP/Agent/Skill，备注按科普叙事写，易懂）；`2.` 会 Loop 的产品工程（三层 Loop / 控制论 / 四框架 Superpowers·GSD·GStack·Trellis）；`3.` 系统架构设计（产品视角）；`4.` 工程规范（`rules/`）；`5.` 多套设计系统（`design/`）。每节配 `备注` 与专业级 SVG。
- **第二部分 · 数字化系统全景 + 案例**：先一张**全景图把 17 案例串成一个数字化系统**（纵向三层 底座/能力/应用 × 横向数据价值闭环 采集→治理→洞察→决策→执行→验收→增长；44/45/46/47=底座），每案例标注 演示原理 + 采用设计 + **在系统中的位置 + 它是哪条理论的实操**；做到 真数据 → 真后端 → 可运行原型 → 真截图 → 交付物 → 可校验。

## 产品级 workbench（`code/`，一服务串起全部）

`bash code/run.sh` 起一个 Fastify+node:sqlite 服务（托管 API + 前端），含：**首页数字化系统全景**（可点节点进案例）+ 学习路径、**AI 概念实验室**（Tokenizer 实时分词 / Context Window 可视化 / RAG Playground / ReAct 智能体游戏，后端真实驱动）、17 案例、**案例↔原理双向溯源**（原理索引）、**在线 API 文档**（/api/openapi.json）、**亮/暗主题**、全站搜索、three.js 懒加载、a11y。

## 目录结构

| 目录 | 内容 |
|---|---|
| `design/` | ≥5 套**各不相同**的深色大屏设计系统（`themes.json` 单一来源令牌 + `*.md` 人读文档），案例分设计 → 风格各异 |
| `rules/` | 工程规范（AI 约束 / 前端 Monorepo·微前端 / 后端分层），对齐 Google/OWASP/Conventional Commits 等并注来源 |
| `skills/` | `pm_skills.md`（62 结构化 Skill）+ `loop_engineering/`（builder/checker/loop/停机规则/记忆区，**工具无关**，不特写任何具体编程工具） |
| `dataset/` | 各案例数据 + `MANIFEST.md`（真实/教学合成显式标注） |
| `code/web/` | Vite + React + TS 深色大屏工作台，一案例一路由 `#/case/NN`，按 design 主题化 |
| `code/tools/*.mjs` | 数据生成/预计算/manifest/设计/skills/文档/校验（单文件均 < 800 行） |
| `outputs/product_case_library/` | 5 manifest + 17 SVG + 34 交付物 md | `assets/screenshots/` | 17 张深色大屏截图 |

## 快速开始

```bash
node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs
node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs && node code/tools/build_docs.mjs
bash code/run.sh   # 一服务托管 API+前端 http://localhost:5200/#/
node code/tools/verify_course_package.mjs   # ALL GREEN（含单一md/多设计/skills/文件<800/无工具品牌）
```

## 环境与常见报错排查

- **Node ≥ 22**（用到实验性 `node:sqlite`）；`node -v` 确认。首次 `bash code/run.sh` 会装依赖+构建前端（约 1–2 分钟），正常打印监听地址 `http://localhost:5200`。
- `node:sqlite` 报错 / `SQLite is not defined` → Node 版本过低，升级到 ≥ 22（`nvm install 22 && nvm use 22`）。
- `EADDRINUSE :5200` → 端口被占用，关掉占用进程或改 `code/run.sh` 端口。
- 页面空白 / 接口 404 → 前端未构建或服务未起，确认 `bash code/run.sh` 打印了监听地址再刷新。
- `npm ci` 失败 → 到 `code/web`、`code/server` 分别 `npm install` 后重试。

## 质量红线

- **教程一个 md**；**DESIGN.md 多套且各不相同**；**理念/原理在前、案例演示验证在后**。
- **Loop 工具无关**（理念/开发模式/skills/prompt），不特写具体编程工具（可用 Trae/CodeBuddy 泛指）。
- **代码约束**（DRY / 单文件 < 800 行 / 组件拆分 / 类型安全 / 中文"为什么"注释 / 错误处理 / 成熟方案优先 / 最小改动）既写进教程 `3.` 章又约束本仓库代码，`verify` 守护。
- 大屏**不同风格**、深色科技风、真实数字、信息密度高；高影响行业保留人工复核；真实/合成数据显式标注。
