# 重新审计：完整性 / 深度 / 趣味性 + 最新 grill-me — 综合发现与执行提案

**日期**：2026-07-14
**触发**：用户「重新审计现有教程的完整性、深度、趣味性，采用最新的 grill-me」
**方法**：4 个只读审计 agent 并行（完整性 / 深度 / 趣味性 / grill-me），各自读遍章节·案例·生成器·数据集后返回排序发现；本文去重合并。
**当前基线**：`verify_course_package.mjs` = **ALL GREEN（877/0）**——无硬断裂；以下全部是校验器盲区里的**软缺口**（叙事陈旧、死配置、互动缺失、深度不均）。

---

## 交叉验证的核心结论
深度审计与完整性审计**独立地**指向同一批最严重问题：**本书最强的机制「demonstrated-not-asserted / 可复现」正被自己的过期数字掏空**——它反复声讨「验证剧场 / 假绿」，而这个病灶已长在书里。这是「修复」二字最该先落的地方，也直接服务「完整性」。

---

## T1 · 诚信性陈旧（最高优先 · 直击「完整性」）
读者照书跑命令得到的真值 ≠ 书里印的数字。真源已更新（`eval_baseline.json`/`case_07.json`/`case_09.json`），漏改的是**叙事正文**。

| # | 问题 | 位置（源文件） | 真值 | 修复 |
|---|---|---|---|---|
| T1-1 | 评测「三幕剧」用 v22 迁移前英文语料数字（194篇/80篇/hit@3/41.7%/91.7%→25%→58.3%/12题5题）当「当场跑出」证据 | `docs/_source/01-ideology.md`(§2.3)、`05-delivery.md`(§5.5)、`10-distributed-ai.md`(§9.5) | 848篇语料·60题金标·**hit@1 96.7%** | 三章统一改到线上真值，或显式标「历史 v-旧语料」并补 CMRC 第四幕收口 |
| T1-2 | Capstone 与设计章仍称 case 02 为「航空 RFM · 久未乘机」 | `docs/_source/99-capstone.md:31`、`04-designs.md:36`（+成书 99/附录A） | case 02 = 大陆 P2P 信贷·信用画像分层 | 改写为信用画像分层；或用孤儿真集 `2b-real_rfm.csv` 真接一个 RFM 锚点 |
| T1-3 | §7.2 硬编码「92条/5天/14版本」并自称「现算·非手填」 | `docs/_source/08-arch-styles.md:55` | 现算真值 98/10/15 | 删具体数字（正文已说「关键不在数字」）或改成生成占位 |
| T1-4 | case 09 story「v13 到 v18」；`08-ddd-deep.md:32`「v18-P1 已合并」 | `case_definitions.json` case9 story | 仓库已 v22 | 改「v13 到 v22」或版本无关表述 |
| T1-5 | case 04 指标链第4项「覆盖主题数」vs 生成器产出「金标问答数=60」——**同句自相矛盾**已进成书 | `case_definitions.json` case4 metricChain/mustMetrics | 生成器为准=金标问答数 | 把 def 的「覆盖主题数」改为「金标问答数」 |
| T1-6 | `eval_harness.mjs` 打印 `hit@3` 标签却计算 hit@1 | `code/tools/eval_harness.mjs` | 判据实为 hit@1 | 改 console 标签为 hit@1（教「指标要说清」的工具自己别错标） |

---

## T2 · 最新 grill-me：升级 + 扩面（直击「趣味性」+ 显式诉求）
现状：`grill.tsx` 纯 reducer、扁平 `GrillStep{q,options,correct,onWrong,onRight}`，**仅 3/9 案（02/04/07）各 2 步**。质量好（真苏格拉底、data-grounded），但结构与集成有洞。

**A. 修 bug / 补机制（小改，高价值）**
- **T2-1 死成就**：`progress.ts` `markGrill()` 写入但 `getProgress()` 从不读 `o.grill`——通关零奖励。加「追问通关」徽章（3→'爱追问'/6→'苏格拉底'），Home 进度卡展示。〔grill-me + 趣味性 双报〕
- **T2-2 结尾悬空**：每案最后一步 `onRight` 是没人回答的反问，缺「所以真正的一课是…」收口。加 `lesson` 字段，`done` 分支渲染为 payoff。
- **T2-3 分支追问**：`onWrong: string` → 按 `s.picked` 分支（`Record<number,string>`，带回退兼容）——不同错法给不同点破。reducer 已存 picked，改渲染层即可。
- **T2-4 首答/被追问后才对**：`GrillState` 加 `erred/attempts`，支撑「一次通关」硬徽章。

**B. 扩面 3→9（纯 JSON 授权，零代码，互动+文档自动渲染）**
为 01/03/05/06/08/09 各写 grill（两审计 agent 已给出 data-grounded 陷阱题，收敛一致）：
- **06 arch**：「目录分了 routes/services/data，架构分层就到位了吗？」→ 名义目录≠真边界，靠适应度函数强制（/api/arch 实扫 import、循环依赖=0）
- **09 eventbus**：「git log 最诚实，用『谁提交多』排绩效很客观吧？」→ 古德哈特：按提交数考核=教人刷提交；追问：rebase 改写公共历史，总线还可信吗（不可变是命根）
- **01 retail**：「某品类销售额环比大涨→加大投入，同意吗？」→ 得同看退货率（虚假繁荣）；且毛利率是教学合成列
- **05 db**：「本地 SQLite 秒出，生产千万行 orders 也不用担心？」→ 缺 (区域,日期) 复合索引=全表扫描（EXPLAIN SCAN vs SEARCH USING INDEX）；SQLite≠生产 PG
- **08 sdd**：「为赶进度砍『③澄清』还是『⑦门禁』更安全？」→ 都不能砍：跳澄清=意图债务，跳门禁=上线才炸
- **03 plan**：「自动生成的『X品类毛利最低→复盘定价』能直接上报吗？」→ 基于合成毛利须先换真实成本；每条须带责任人+验收

---

## T3 · 互动集成（趣味性）
- **T3-1 06/09 全被动**：零可点——由 T2-B 的 grill 直接补上（管线已在，最省力）。
- **T3-2 Challenge 跑偏/假角色**：05/07/08 的「你来决策」用遗留订单 owner 或 `演示角色`，与本案主题脱节、教不了东西。改为按主题门控，或换案例专属单选（05:选哪个索引 / 08:哪步不能砍）。
- **T3-3 Lab 孤岛**：`lab.tsx` 4 个真交互（Tokenizer/ContextWindow/RAG Playground/ReAct）藏在 `/lab` 顶栏，案例页不嵌。把 RAG Playground 嵌进 case 04 脚部。
- **T3-4 case 02「先猜再揭晓」**：全书最锋利的反转（薄档52%>优质6%）被静态柱状图剧透。改成先让读者猜哪层放款率最高再揭晓。
- **T3-5 章门跳钩子**：`01-ideology.md`/`05-delivery.md`/`99-capstone.md` 开篇直入「学习目标」清单，缺一句故事钩子。
- **T3-6 视觉单调**：06/07/08 同 cyan-matrix 主题+KPI瓦片+纯表，连着看是低点；至少重皮一个 + 给 06 真依赖图 SVG。

---

## T4 · 深度补强（深度 · 全部锚现有真数据·不碰红线）
- **T4-1 case 03 最浅**：与 01 同数据同设计，`theoryOp` 自曝「本案可先不管」对冲了「综合闭环」承诺。补一次真跨案例链（05 SQL 底座→04 召回方法→一个决策数字），或至少加 T4-3 的 base-rate beat。
- **T4-2 case 05 第二浅**：规模垂直全靠断言。在真实 4500 行表上给「加索引前后 SCAN→SEARCH USING INDEX」真实对照（可跑可截图），把口号变可观测证据。
- **T4-3 case 01/03 补反直觉 beat**（MANIFEST 有据）：① 英国营收最高=数据主场体量假象（base-rate 混淆，与 case 02 同型）；② 异常率 11.1% 是教学 ×5 过采样（真实约 2%），别当真实经营水平。
- **T4-4 术语表**：44 行扁平词表加「see also」簇（RAG 簇 / DDD 战术件簇 / 门禁簇）；修 `RFM` 锚点（现误指 case 02）。
- **T4-5 design 文档 case_01/03**：仍把真实 UCI 基座误标「确定性合成」「1200单」——与 MANIFEST 冲突、擦红线反向（把真实说成合成）。按 `case_02.md` 模板重写、行数/性质对齐。
- **T4-6（低）** §11 软技能多为「重命名式」断言（仅 10.5 有动手）；§04 设计章演示最少。

---

## T5 · 死代码 / 技术债清理（完整性 · 单一真源卫生）
- **T5-1 archetypes 整块 ~168 行死配置**（`case_definitions.json:4-168`，code/tools 零引用，12 个 archetype 无案例命中）——裁剪或整删。
- **T5-2 must\* 系列死字段**（mustFields/mustMetrics/mustExceptions/mustSkills，生成器/校验器零消费，且与真实字段自相矛盾）——删除或接入 verify 成真断言。
- **T5-3 孤儿数据集** `2b-real_rfm.csv`（1665 行，生成+MANIFEST 登记，无案例消费）——接入某案例（见 T1-2/RFM 锚点）或停生成+删 MANIFEST 行。
- **T5-4 零散一致性**：theoryOp「案例04–06」应为「05–06」；`projectNameEn` 旧「PM Transformation」→ 与 README「Self-Verifying AI Engineering Handbook」对齐；case2 `uiStrategy` 仍写 sales_funnel→对齐 credit_seg；04/07/09 缺 lensViews 结构不齐；「门禁165 vs 检查877」两口径页面标注消歧。

---

## superpower 纪律（全程）
- 单一真源改 `case_definitions.json` → 生成器重建 → 三绿（verify + skill_lint + eval_harness + node:test + vitest）。
- grill 每处 TDD：先加/改 `grill.test.ts` 见红 → 实现 → 绿。
- 数据类/叙事类改动：改前 grep 出全部同源镜像（源 + 成书 + 案例 md），一处不漏；数字类改后实跑对拍。
- 红线：不臆造数据、不把合成标真实（T4-5 是反向红线：别把真实标合成）；扩 grill 全部锚真实数据/决策。
- 不弱化任何守卫；新增守卫钉住 T1（叙事真值 = 生成器真值）防回退。

## 不做（YAGNI）
- 不新增案例/章/数据集（除非 T5-3 决定把 2b-real_rfm 接线）；不动 §1 aiagent 授权敞口（用户侧）；grill 不做无限追问/free-text（破坏纯 reducer 离线架构）；不接 Kaggle 合成陷阱集。
