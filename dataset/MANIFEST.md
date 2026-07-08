# 数据集清单（会自检的 AI 工程 · 实操手册）

为课堂可复现且诚信：多数计分案例已迁移到**真实公开数据基座**（见下「真实基座快照」，来源/许可/sha256 齐全）；确因源缺失的少数列（如零售毛利率、物流配送时效）为**确定性教学合成叠加**并在「性质」列与案例正文显式标注；其余无真实源的案例为**确定性教学合成**（固定种子）。**绝不把合成说成真实。** 生成：`node code/tools/fetch-datasets.mjs`（读 `dataset/real/*` 快照 → 归一化为中文表头，零联网）。

| 文件 | 行/项 | 性质 | sha256 |
|---|---|---|---|
| order_data.csv | 4500 | 真实基座 UCI Online Retail II（CC BY 4.0）+ 标注合成叠加(毛利率/库存天数/责任人/处理时限) | eaa853c1e499fe93… |
| reference_data_analysis/2-air_data.csv | 800 | 教学合成（航空会员 RFM，分层与 R/F/M 强相关、埋高价值流失群） | 304b2a8588d0a70f… |
| reference_data_analysis/2b-real_rfm.csv | 1665 | 真实基座派生（UCI 零售快照 CustomerID 级 RFM 真算；分层为分位规则派生、非事实标签） | 8592e365467c57f1… |

## 真实基座快照（dataset/real/*，采样自公开数据集，构建期零联网）

| 快照 | 来源 | 许可 | 用于 | sha256 |
|---|---|---|---|---|
| dataset/real/retail_online_retail_ii.csv | [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii) | CC BY 4.0 | 案例 01/41/45 零售基座 | d10bc242cb89faf4… |

> 快照由一次性采样脚本生成（分层过采样：退货约 ×5 以便教学展示，异常率 11.1% 不代表真实业务水平——UCI 原始约 2%；无随机、无联网）；生成器读快照后归一化。真实列直接用真实效应；缺失列为确定性教学合成叠加、已标注，绝不把叠加说成真实。

## 可用但刻意未接线的真实源（v17 瘦身裁撤，回补须先有案例与教学理由）

- CMS Timely & Effective Care (医院急诊)：https://data.cms.gov/provider-data/dataset/yv7e-xc69
- US DOT On-Time (航班准点)：https://www.transtats.bts.gov/
- UCI Default of Credit Card Clients：https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients

结构化 Skill 库：skills/pm_skills.md（手工维护，发布前经 skill_lint.mjs 扫描）。

## vendored 真实素材（非合成，注明来源/许可）
- `assets/vendor/lucide/`：Lucide 图标（github.com/lucide-icons/lucide，ISC 许可），内联进 §1 概念图。
- `assets/vendor/aiagent/`：55 张真实 AI 原理图 + `docs/_source/reference/` 5 份权威文档（源用户提供的 `AI agent/` 参考包），深化 §1。**许可待确认**：图包未附 LICENSE/README 等授权说明，商业发售前须取得书面授权或替换（§1 引用图清单与替换预案见 `outputs/aiagent_license_todo.md`）。
- `skills/external/pm-skills-deanpeters/`：deanpeters/Product-Manager-Skills（MIT），案例44 RAG 语料。

## 逐案数据集设计说明
- 精品案例的数据集设计意图/字段义/数据故事见 `dataset/design/case_NN.md`（如 case_30 航空 RFM）。
