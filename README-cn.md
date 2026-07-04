# 产品经理转型实操知识库

面向技术骨干与项目经理的**产品经理转型实操知识库**。**整体逻辑：先讲系统设计的理念、原理、工程规范与多套设计，再用不同案例来演示、验证**。唯一教程文件是 `产品经理转型实操知识库.md`。

## 教程结构（单一 md）

- **第一部分 · 理念与原理**：`1.` 理念框架（三层 Loop / 提示词→上下文→脚手架→循环 / 控制论「传感器即设计」/ Loop 六件套 / 何时建 Loop / AI 软件工程四框架 Superpowers·GSD·GStack·Trellis）；`2.` 系统架构设计（产品视角，约束→质量属性→分解→契约→ADR→部署）；`3.` 工程规范与代码约束（沉淀到 `rules/`）；`4.` 多套设计系统（`design/`）。编号 `1./1.1/1.1.1`，每节配 `备注` 与 SVG。
- **第二部分 · 案例演示与验证**：21 个案例（含综合案例），每个标注**演示的原理 + 采用的设计**，做到 真数据 → 可运行深色大屏原型 → 真截图 → 两份交付物 → 章节 → 可校验。

## 目录结构

| 目录 | 内容 |
|---|---|
| `design/` | ≥5 套**各不相同**的深色大屏设计系统（`themes.json` 单一来源令牌 + `*.md` 人读文档），案例分设计 → 风格各异 |
| `rules/` | 工程规范（AI 约束 / 前端 Monorepo·微前端 / 后端分层），对齐 Google/OWASP/Conventional Commits 等并注来源 |
| `skills/` | `pm_skills.md`（52 结构化 Skill）+ `loop_engineering/`（builder/checker/loop/停机规则/记忆区，**工具无关**，不特写任何具体编程工具） |
| `dataset/` | 各案例数据 + `MANIFEST.md`（真实/教学合成显式标注） |
| `coderef/react_pm_cases/` | Vite + React + TS 深色大屏工作台，一案例一路由 `#/case/NN`，按 design 主题化 |
| `coderef/*.mjs` | 数据生成/预计算/manifest/设计/skills/文档/校验（单文件均 < 800 行） |
| `outputs/product_case_library/` | 5 manifest + 25 SVG + 42 交付物 md | `assets/screenshots/` | 22 张深色大屏截图 |

## 快速开始

```bash
node coderef/fetch-datasets.mjs && node coderef/build_case_data.mjs
node coderef/build-manifests.mjs && node coderef/build-skills.mjs && node coderef/build-designs.mjs && node coderef/build_docs.mjs
cd coderef/react_pm_cases && npm ci && npm run build && npm run preview   # http://localhost:4173/#/
node coderef/verify_course_package.mjs   # ALL GREEN（含单一md/多设计/skills/文件<800/无工具品牌）
```

## 质量红线

- **教程一个 md**；**DESIGN.md 多套且各不相同**；**理念/原理在前、案例演示验证在后**。
- **Loop 工具无关**（理念/开发模式/skills/prompt），不特写具体编程工具（可用 Trae/CodeBuddy 泛指）。
- **代码约束**（DRY / 单文件 < 800 行 / 组件拆分 / 类型安全 / 中文"为什么"注释 / 错误处理 / 成熟方案优先 / 最小改动）既写进教程 `3.` 章又约束本仓库代码，`verify` 守护。
- 大屏**不同风格**、深色科技风、真实数字、信息密度高；高影响行业保留人工复核；真实/合成数据显式标注。
