# 数据集清单（会自检的 AI 工程 · 实操手册）

为课堂可复现且诚信：多数计分案例已迁移到**真实公开数据基座**（见下「真实基座快照」，来源/许可/sha256 齐全）；确因源缺失的少数列（如零售毛利率、物流配送时效）为**确定性教学合成叠加**并在「性质」列与案例正文显式标注；其余无真实源的案例为**确定性教学合成**（固定种子）。**绝不把合成说成真实。** 生成：`node code/tools/fetch-datasets.mjs`（读 `dataset/real/*` 快照 → 归一化为中文表头，零联网）。

| 文件 | 行/项 | 性质 | sha256 |
|---|---|---|---|
| order_data.csv | 4500 | 真实基座 UCI Online Retail II（CC BY 4.0）·真实数值 + 本地化改写实体标签(品类→中国电商类目/区域→中国省份/£→¥单位·非原始地理) + 标注合成叠加(毛利率/库存天数/责任人/处理时限) | 2c074ccbdc6f2015… |
| reference_data_analysis/p2p_credit.csv | 20349 | 真实基座派生（人人贷 P2P，CC0；放款成功/金额/额度/征信/文案特征为真实列直取或 log 还原；信用画像/风险信号为规则派生分层、非事实标签；标的=放款成功非违约） | 56e4560c937c5394… |
| rag/gold.json | 60 | 真实基座派生（CMRC2018 dev 抽样 60 题中文 QA 金标；docPattern 匹配 dataset/rag/corpus/*.md 文件名） | 93c0baf67c2fcbff… |
| reference_data_analysis/2b-real_rfm.csv | 1665 | 真实基座派生（UCI 零售快照 CustomerID 级 RFM 真算；分层为分位规则派生、非事实标签）·**案例03 综合闭环经 /api/rfm 真实消费**（「高价值流失」群=会员经营抓手） | 8592e365467c57f1… |

## 真实基座快照（dataset/real/*，采样自公开数据集，构建期零联网）

| 快照 | 来源 | 许可 | 用于 | sha256 |
|---|---|---|---|---|
| dataset/real/retail_online_retail_ii.csv | [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii) | CC BY 4.0 | 案例 01/03/05 零售基座（数值真实，实体本地化改写为中国类目/省份） | d10bc242cb89faf4… |
| dataset/real/cmrc2018_dev.json | [CMRC2018 dev（哈工大讯飞 HFL·中国大陆）](https://github.com/ymcui/cmrc2018) | CC BY-SA-4.0 | 案例 04/07 中文 RAG 语料 + 金标 | e9ff74231f05c230… |
| dataset/real/renrendai_p2p.csv | [人人贷 P2P 借贷记录（Harvard Dataverse doi:10.7910/DVN/C4RUDY·中国大陆）](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/C4RUDY) | CC0-1.0 | 案例 02 大陆 P2P 信贷·信用画像分层 | a2d1b494bf45b06b… |
| dataset/real/ruoyi_cloud_arch.json | [RuoYi-Cloud（若依·国产开源微服务脚手架）](https://github.com/yangzongzhuan/RuoYi-Cloud) | MIT | 案例 06 系统架构（22 模块依赖边 + 3 Feign 接口契约，从 pom.xml/@FeignClient 确定性解析·零代码执行） | 166912a706b67132… |
| dataset/real/nacos_git_events.json | [alibaba/nacos（阿里·国产开源注册/配置中心）](https://github.com/alibaba/nacos) | Apache-2.0 | 案例 09 事件溯源（近 600 提交事件流 + 父指针 DAG，与本仓库 dogfood 小事件流大小对照；作者邮箱已 hash 脱敏） | 7a27e180ede8a267… |
| dataset/real/webmedqa_slice.json | [webMedQA（中文医疗健康问答）](https://github.com/hejunqing/webMedQA) | Apache-2.0 | 案例 04/07 中文医疗知识库 RAG + 评测（120 组 1正4负·原生 P@1/hit@k 金标；公开健康咨询、无 PII、仅 dev 小切片） | 533fb405a14ec39b… |
| dataset/real/beijing_air_quality.csv | [UCI 北京多站点空气质量](https://archive.ics.uci.edu/dataset/501/beijing+multi+site+air+quality+data) | CC BY 4.0 | 案例 05 数据工程·大表查询优化（12 国控站真实逐时监测，本快照取每 3 小时一条=140256 行控体积、真实数值/NA 缺口不改；生产规模用 CROSS JOIN 自扩展） | bb918cb17320d2ac… |

> **零售快照**由一次性采样脚本生成（分层过采样：退货约 ×5 以便教学展示，异常率 11.1% 不代表真实业务水平——UCI 原始约 2%；无随机、无联网），生成器读快照后归一化，真实数值列直接用真实效应、实体标签本地化改写（已标注）。**CMRC2018 / 人人贷** 为公开集**完整/直接快照**（未过采样、未改数值），仅归一化中文表头与 log 还原、规则派生分层均已标注为「派生·非事实标签」。缺失列的确定性教学合成叠加已标注，绝不把叠加/派生说成真实。

## 可用但刻意未接线的真实源（v17 瘦身裁撤，回补须先有案例与教学理由）

- CMS Timely & Effective Care (医院急诊)：https://data.cms.gov/provider-data/dataset/yv7e-xc69
- US DOT On-Time (航班准点)：https://www.transtats.bts.gov/
- UCI Default of Credit Card Clients：https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients

结构化 Skill 库：skills/pm_skills.md（手工维护，发布前经 skill_lint.mjs 扫描）。

## vendored 真实素材（非合成，注明来源/许可）
- `assets/vendor/lucide/`：Lucide 图标（github.com/lucide-icons/lucide，ISC 许可），内联进 §1 概念图。
- `assets/vendor/aiagent/`：55 张真实 AI 原理图 + `docs/_source/reference/` 5 份权威文档（源用户提供的 `AI agent/` 参考包），深化 §1。**许可待确认**：图包未附 LICENSE/README 等授权说明，商业发售前须取得书面授权或替换（§1 引用图清单与替换预案见 `outputs/aiagent_license_todo.md`）。
- `skills/external/pm-skills-deanpeters/`：deanpeters/Product-Manager-Skills（MIT），早期英文 RAG 语料（已由 CMRC2018 中文语料取代为案例 04/07 主语料，保留作英文对照）。
- `dataset/rag/corpus/`：CMRC2018 dev 派生中文语料（每 context 一 .md，供 store.ts 检索）；`dataset/rag/gold.json`：60 题中文金标。**CC BY-SA-4.0（署名 + 相同方式共享）**，仅教学引用、不商业再分发衍生。

## 逐案数据集设计说明
- 精品案例的数据集设计意图/字段义/数据故事见 `dataset/design/case_NN.md`。
