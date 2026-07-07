# 数据集清单（AI 时代一体化实操知识库）

为课堂可复现且诚信：多数计分案例已迁移到**真实公开数据基座**（见下「真实基座快照」，来源/许可/sha256 齐全）；确因源缺失的少数列（如零售毛利率、物流配送时效）为**确定性教学合成叠加**并在「性质」列与案例正文显式标注；其余无真实源的案例为**确定性教学合成**（固定种子）。**绝不把合成说成真实。** 生成：`node code/tools/fetch-datasets.mjs`（读 `dataset/real/*` 快照 → 归一化为中文表头，零联网）。

| 文件 | 行/项 | 性质 | sha256 |
|---|---|---|---|
| order_data.csv | 4500 | 真实基座 UCI Online Retail II（CC BY 4.0）+ 标注合成叠加(毛利率/库存天数/责任人/处理时限) | eaa853c1e499fe93… |
| reference_data_analysis/28-credit_default_sample.csv | 3000 | 真实基座 UCI Default of Credit Card Clients（CC BY 4.0，30000 名台湾信用卡客户真实违约） | ffd577718235c34c… |
| product_cases/hospital_ed_timely.csv | 4077 | 真实基座 CMS Timely & Effective Care - Hospital（公共领域，美国急诊及时性） | 9dfdf4af63c4ab1f… |
| product_cases/flights_ontime.csv | 1500 | 真实基座 US DOT On-Time Performance 2024-06（公共领域，611k 航班抽样，起飞城市延误/取消/原因全真实） | 4283411911b2e308… |
| reference_data_analysis/2-air_data.csv | 800 | 教学合成（航空会员 RFM，分层与 R/F/M 强相关、埋高价值流失群） | 304b2a8588d0a70f… |
| reference_data_analysis/18-ad_performance.csv | 30 | 教学合成（广告投放漏斗，渠道×活动 30 行，埋落地页/优质渠道差异） | 824e768208b26f1b… |

## 真实基座快照（dataset/real/*，采样自公开数据集，构建期零联网）

| 快照 | 来源 | 许可 | 用于 | sha256 |
|---|---|---|---|---|
| dataset/real/retail_online_retail_ii.csv | [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii) | CC BY 4.0 | 案例 01/41/45/47 零售基座；14 跨境目的地/单量基座 | d10bc242cb89faf4… |
| dataset/real/finance_uci_default_credit.csv | [UCI Default of Credit Card Clients](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) | CC BY 4.0 | 案例 28 金融复核基座（真实违约） | bbd75ad540333e09… |
| dataset/real/hospital_cms_ed_timely.csv | [CMS Timely and Effective Care - Hospital](https://data.cms.gov/provider-data/dataset/yv7e-xc69) | 公共领域（美国政府作品） | 案例 16 医院急诊及时性基座 | e25545de4f95e6d8… |
| dataset/real/flights_usdot_ontime.csv | [US DOT On-Time Performance 2024-06](https://www.transtats.bts.gov/) | 公共领域（美国政府作品） | 案例 14 航班准点运营基座（起飞城市延误/取消/原因） | d136ce17bb331361… |

> 快照由一次性采样脚本生成（等距抽样、无随机、无联网）；生成器读快照后归一化。真实列直接用真实效应；缺失列为确定性教学合成叠加、已标注，绝不把叠加说成真实。

结构化 Skill 库：skills/pm_skills.md（手工维护，发布前经 skill_lint.mjs 扫描）。

## vendored 真实素材（非合成，注明来源/许可）
- `assets/vendor/lucide/`：Lucide 图标（github.com/lucide-icons/lucide，ISC 许可），内联进 §1 概念图。
- `assets/vendor/aiagent/`：57 张真实 AI 原理图 + `docs/_source/reference/` 5 份权威文档（源用户提供的 `AI agent/` 参考包），深化 §1。
- `skills/external/pm-skills-deanpeters/`：deanpeters/Product-Manager-Skills（MIT），案例44 RAG 语料。

## 逐案数据集设计说明
- 精品案例的数据集设计意图/字段义/数据故事见 `dataset/design/case_NN.md`（如 case_30 航空 RFM）。
