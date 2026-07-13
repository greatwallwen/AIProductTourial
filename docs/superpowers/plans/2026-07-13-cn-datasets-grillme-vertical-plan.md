# 中国数据集化 + grill-me + 垂直深化 — 实施计划

> **执行方式**：本会话内 executing-plans，逐任务 TDD（种错见红→实现→再绿），每 1-2 任务一提交。
> **规格**：`docs/superpowers/specs/2026-07-13-cn-datasets-grillme-vertical-design.md`

**Goal**：把外国/合成数据换成大陆真集（CMRC2018 中文RAG、人人贷 P2P 信贷）+ 电商本地化；A 档三案例（02/04/07）加 grill-me 苏格拉底追问 + 垂直深化；全程守数据红线与三绿。

**Architecture**：`fetch-datasets.mjs` 读 `dataset/real/*` 快照零联网归一化 → `build_case_data.mjs` 出 `case_NN.json` → React 渲染；`store.ts`(TF-IDF+中文二元组) 是 RAG 被测系统；`eval_harness.mjs` 读 `eval_gold.json` 真调 search() 算 hit@3。

**关键既有事实**（recon 已证）：
- `store.ts` 已支持中文（`[一-龥]` 二元组分词）→ CMRC 中文检索开箱可用。
- 04 走 `buildFromMd`；07 走 `c.num===7` 特殊分支调 `eval_harness --json`；02 走 `buildFromCsv`。
- eval_gold = `{_comment,judge,gold:[{q,kw,docPattern}]}`；CORPUS 现指 `skills/external/pm-skills-deanpeters`。
- 人人贷标的 `Success`=放款成功（20.6%），非违约；`education` 序数不臆造名；`periods` 归一化弃用。

---

## Task 1：Vendor 两个大陆真集快照 + MANIFEST + 校验守卫

**Files**：Create `dataset/real/cmrc2018_dev.json`、`dataset/real/renrendai_p2p.csv`；Modify `dataset/MANIFEST.md`、`code/tools/verify_course_package.mjs`

- [ ] 1.1 从 scratchpad 拷入已下载并校验的快照（cmrc2018_dev.json sha `e9ff74…c7f1f`；renrendai_p2p.csv 由 xlsx stdlib 转，源 xlsx sha `a75a14…caef`）。
- [ ] 1.2 MANIFEST 加两行「真实基座快照」（来源 URL/DOI、许可 CC BY-SA-4.0 / CC0-1.0、sha256、用于案例）。
- [ ] 1.3 **守卫先行(TDD)**：verify 加 `dataset/real/` 每 .json/.csv 必须在 MANIFEST 出现且 sha256 与实际一致——先加断言跑红（新快照未登记）→ 登记 → 绿。

## Task 2：fetch-datasets.mjs — 人人贷 P2P 归一化块

**Files**：Modify `code/tools/fetch-datasets.mjs`；Output `dataset/reference_data_analysis/p2p_credit.csv`

- [ ] 2.1 加块：读 `dataset/real/renrendai_p2p.csv` → 中文表头 `借款号,放款成功,借款金额,学历等级,历史成功次数,授信额度,有征信报告,描述字数,有效字符率,复杂词比例,主题1,主题2,主题3,主题4,信用画像`。
  - 派生（全真实）：`借款金额`=round(10^Amount(log))、`授信额度`=round(10^credit限额log)、`有征信报告`=credit report? '有':'无'、`放款成功`=Success(1/0)。
  - `信用画像`=规则派生：score = (有征信?2:0)+min(历史成功次数,3)+(授信额度分位)，切「优质/成长/待观察/薄档」，label 标注"规则派生非事实"。
  - `periods` 弃用（不写入，避免误导）。
- [ ] 2.2 results.push label 标 hybrid？→ 否：真实列直取 + 规则派生分层（非合成叠加）→ 标"真实基座派生（人人贷 CC0；信用画像为规则派生分层、非事实标签）"。
- [ ] 2.3 删除合成航空块（`2-air_data.csv` 生成段）；保留 `2b-real_rfm.csv` 块。
- [ ] 2.4 跑 `node code/tools/fetch-datasets.mjs`，验证 p2p_credit.csv 行数=20349、放款成功率≈20.6%。

## Task 3：fetch-datasets.mjs — CMRC 中文 RAG 语料 + 金标

**Files**：Modify `code/tools/fetch-datasets.mjs`；Output `dataset/rag/corpus/*.md`(848)、`dataset/rag/gold.json`

- [ ] 3.1 加块：读 `dataset/real/cmrc2018_dev.json` → 每 paragraph.context 写一个 `.md` 文件到 `dataset/rag/corpus/`，文件名=`cmrc_<article-index>_<slug>.md`（slug 取 title 前若干中文，去特殊字符；确定性）；正文首行 `# <title>` + context。
- [ ] 3.2 金标：确定性抽样 N=60（每篇取首问，按 article 序，截 60）→ `dataset/rag/gold.json`，每条 `{q:question, kw:answer去空格取前4字, docPattern:文件名基名转义}`。
- [ ] 3.3 跑 fetch，验证 corpus 文件数（848 唯一 context 数）与 gold 60 条；抽查一条 docPattern 能匹配对应 .md 名。

## Task 4：fetch-datasets.mjs — 电商 order_data 本地化

**Files**：Modify `code/tools/fetch-datasets.mjs`（order_data 生成块）

- [ ] 4.1 加两张确定性映射：英文品类→中国电商类目（家居/3C数码/美妆个护/服饰鞋包/食品生鲜/母婴/图书文娱/运动户外/其他）、UCI 国家→中国省份（轮转分配，种子固定）。改写 `品类`/`区域` 两列。单价单位注释 £→¥（数值不变）。
- [ ] 4.2 MANIFEST order_data 性质列改 hybrid「真实数值效应 + 本地化改写实体标签（类目/区域为教学本地化，非 UCI 原始地理）」。
- [ ] 4.3 跑 fetch，验证 order_data 类目全中国类目、区域全中国省份、行数不变(4500)。

## Task 5：eval 管线切中文 + 重建基线

**Files**：Modify `code/tools/eval_harness.mjs`（CORPUS 常量）、`code/data/eval_gold.json`（由 gold.json 生成）

- [ ] 5.1 eval_harness `CORPUS` → `dataset/rag/corpus`；`walk`/texts 同源。
- [ ] 5.2 eval_gold.json 的 gold 数组 ← Task3 的 `dataset/rag/gold.json`（保留 `_comment`/`judge`）。
- [ ] 5.3 跑 `node code/tools/eval_harness.mjs --json` 看真实 hit@3；`--update` 立新基线。记录基线值入 case 07 内容。

## Task 6：case_definitions.json — case 02 改造为 P2P 信贷信用分层

**Files**：Modify `code/tools/case_definitions.json`(case 2)

- [ ] 6.1 改 02：title「信用画像分层｜大陆 P2P 信贷放款」、industry「P2P信贷」、dataset `dataset/reference_data_analysis/p2p_credit.csv`、abColumn `信用画像`（异常队列=薄档/待观察）、fields=新中文列、metricSpec：放款成功率(rate col=放款成功 arg=1)、征信完整率(rate col=有征信报告 arg=有)、优质画像占比(rate col=信用画像 arg=优质)、借款金额均值(avg)、历史成功次数均值(avg)。
- [ ] 6.2 decisionAction「按信用画像分层给差异化放款/额度/人工复核策略」、riskBoundary「高影响金融·保留人工复核；禁按性别/学历做歧视性拒贷」、highImpact `true`。
- [ ] 6.3 insight/pitfall/tldr 重写（真实洞见：文案质量+征信完整度驱动放款转化；坑：拿放款成功当"还得起"因果、只看额度不看信用画像）。demonstrates 保留分层相关原理码。
- [ ] 6.4 加 `grill`（见 Task 8 数据模型），2-3 步锚真实数据。

## Task 7：case_definitions.json — 04/07 中文RAG + 01/03/05 本地化 + grill/vertical

**Files**：Modify `code/tools/case_definitions.json`(4,7,1,3,5)

- [ ] 7.1 04：dataset `dataset/rag/corpus`、industry「中文知识库」、insight/pitfall 更中文语料（召回@k、幻觉、忠实度）；加 `grill` + 垂直 KPI/术语；title「中文知识库语义检索(RAG)」。
- [ ] 7.2 07：dataset 描述改「CMRC2018 中文语料 + 标注 Q/A」、更新三幕剧数字为新基线（历史叙事保留、live 数改新值）；加 `grill`。
- [ ] 7.3 01/03/05：fields/labels 随本地化列名微调（品类/区域中国化）；**不加 grill**（B 档仅数据）。
- [ ] 7.4 加垂直字段（若 case_definitions 支持 `verticalKpis`/`failLog` 则填；否则并入 insight/pitfall/tldr）——按现有 schema，落到 insight/pitfall + 正文生成。

## Task 8：grill.tsx 组件 + 测试 + 接线

**Files**：Create `code/web/src/grill.tsx`、`code/web/src/grill.test.ts`；Modify `code/web/src/screens.tsx`（案例页接线）、`code/web/src/progress.ts`（grill 计数，可选）

数据模型（case_NN.json 透传自 case_definitions）：
```
grill: [ { q:"题干", options:["A","B","C"], correct:0,
           onWrong:"针对错答的追问·点破误区", onRight:"对答后的深化追问" }, ... ]
```
- [ ] 8.1 **测试先行**：`grill.test.ts`——给定 2 步 grill：选错→返回 `{stage:0, showProbe:'onWrong文案', advanced:false}`；选对→`{stage:1, advanced:true}`；末步选对→`{done:true}`。纯 reducer 函数 `grillStep(state, pick)`。跑红。
- [ ] 8.2 实现 `grillStep` reducer + `<Grill data={caseData}/>` 组件（≈100 行）：逐步渲染、错答显示 onWrong 追问并允许重选、对答进阶、末步完成计入成就。跑绿。
- [ ] 8.3 screens.tsx 案例页在「你来决策」下方渲染 `<Grill>`（仅当 caseData.grill 存在）。
- [ ] 8.4 `npx vitest run src/grill.test.ts` 绿。

## Task 9：build_case_data grill 透传 + verify 三守卫

**Files**：Modify `code/tools/build_case_data.mjs`、`code/tools/verify_course_package.mjs`

- [ ] 9.1 build_case_data：case_NN.json 输出透传 `grill` 字段（buildFromCsv/buildFromMd 都带）。
- [ ] 9.2 verify 守卫②：A 档案例(02/04/07)`grill` 存在且每步 options 含 correct 下标、onWrong 非空——先断言跑红→补齐→绿。
- [ ] 9.3 verify 守卫③：p2p_credit / rag 派生物在 MANIFEST 性质列标注正确（无"合成标真实"）；`信用画像`/`gold` 标"规则派生/派生"。

## Task 10：文档「被追问」段 + 垂直深化（build_docs 驱动）

**Files**：Modify `code/tools/build_docs.mjs`（渲染 grill → 「## 被追问(grill-me)」段）

- [ ] 10.1 build_docs 若案例有 grill，生成「## 被追问」markdown：问→常见错答(onWrong)→真解。
- [ ] 10.2 跑 build_docs，抽查 02/04/07 生成的 md 含「被追问」段与新垂直 KPI/失败实录。

## Task 11：全量重建 + 三绿 + 截图 + 提交推送

- [ ] 11.1 `node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs && node code/tools/build_docs.mjs`。
- [ ] 11.2 三绿：`node code/tools/verify_course_package.mjs`、`node code/tools/skill_lint.mjs`、`node code/tools/eval_harness.mjs`、`node --test code/tools/*.test.mjs`、`npx vitest run`（web）。
- [ ] 11.3 必要重截 02/04/07 截图（screenshot_cases + 边车传感器 diff）。
- [ ] 11.4 `adversarial_review.mjs` 两轮 0（若存在）+ content_snapshot 报告。
- [ ] 11.5 提交（分批）+ 合并 main + 推送（GitHub classic ghp_，日志 sed 掩码）。

---

## 风险登记
- **CMRC 848 .md 文件**：数量大但 loadDir 支持；确保文件名 slug 唯一、docPattern 可匹配。
- **eval 基线漂移**：中文语料 hit@3 会与英文基线不同——`--update` 立新基线并在 07 如实叙述（非造假）。
- **人人贷标的语义**：`Success`=放款成功非违约——正文/grill 必须说清，禁称"违约率/还款能力"。
- **电商本地化红线**：类目/区域为本地化改写，绝不称 UCI 原始事实——MANIFEST + 正文双标注。
- **三幕剧历史数字**：保留历史叙事，live 数更新为新基线，两者不混。
