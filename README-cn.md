# 产品经理转型实操知识库

面向技术骨干与项目经理的**产品经理转型实操知识库**。同一套 PM 工作流（角色转型 → 用户洞察 → 需求管理 → 产品定位 → 详细设计 → 数据指标 → AI 协作 → 质量验收 → 综合闭环），在 **19 个真实行业场景**各走一遍，每个案例都做到：**真数据 → 可运行 React 原型 → 真截图 → 两份交付物 → 手册章节 → 可校验**。

## 目录结构

| 目录 | 内容 |
|---|---|
| `dataset/` | 各案例数据集 + `MANIFEST.md`（来源/许可/sha256，真实与教学合成显式标注） |
| `coderef/react_pm_cases/` | Vite + React + TS 工作台，一案例一路由 `#/case/NN` |
| `coderef/*.mjs` | 数据生成、预计算、manifest 生成、文档生成、全量校验 |
| `outputs/product_case_library/` | 5 个 manifest + 19 张 SVG + 38 份交付物 md |
| `outputs/07_skills/pm_skills.md` | 46 个结构化可验证 Skill（六槽） |
| `assets/screenshots/` | 20 张真实运行截图 |
| `产品经理转型实操知识库.md` | 主手册（19 案例五段式，内嵌 SVG 与截图） |

## 快速开始

```bash
node coderef/fetch-datasets.mjs        # 生成/下载数据集 → dataset/
node coderef/build_case_data.mjs       # 真实数据 → 每案例预计算 JSON
node coderef/build-manifests.mjs       # 5 个 manifest
node coderef/build-skills.mjs          # Skill 库
node coderef/build_docs.mjs            # SVG + 交付物 + 主手册
cd coderef/react_pm_cases && npm ci && npm run build && npm run preview  # 工作台 http://localhost:4173/#/
node coderef/verify_course_package.mjs # 全量校验 ALL GREEN
```

## 质量红线

- **真实/合成显式标注**：数据集在 `MANIFEST.md` 逐一标注真实公开源或「教学合成」，绝不谎称真实。
- **高影响行业**（金融/医疗/政务/银行/保险）：保留人工复核，不得自动授信、处罚、诊断、拒绝交易；原型顶部横幅与交付物均声明边界。
- **可运行 + 可校验**：每案例有可访问路由与真截图；`verify_course_package.mjs` 逐项核验字段/指标/Skill/截图，ALL GREEN 才算完成。
- **不得通用表格占位**：每屏按各自 UI 原型渲染，数据与视觉各异。

## 写法说明

写法参照 AI 编程实操标准：每案例以**构建契约式 Prompt**（功能+技术+目录+验收）驱动，产出真正可运行的成品并给「跑通与纠错」。手册每章含：项目场景故事 / 任务目标与数据 / Prompt 实操 / 图形·原型·表单 / 交付物与验收（+ 指定实操融合）。

> 数据为课堂可复现的确定性教学合成（结构对齐所引用真实公开数据集，如 UCI Online Retail 352、NYC 311、UCI Bank）；接入真实数据见 `coderef/fetch-datasets.mjs`。
