# 中国数据集化 + grill-me 苏格拉底追问 + 垂直深化 — 设计文档

**日期**：2026-07-13
**状态**：已批准（用户「全部按建议来」）
**前置**：v21 完成（案例 01-09、icon 化、每章配实操）。本轮不加章、不铺摊子，聚焦"真数据 + 真互动 + 真垂直"。

## 目标（一句话）
把外国/合成数据集换成**中国市场真实数据集**（有干净开源许可的直接落地，其余诚实降级/本地化），并用 **grill-me 苏格拉底追问** + **垂直行业深化**优化精品案例，全程守 superpower 的 TDD / 数据红线 / 三绿纪律。

## 范围（两档）

### A 档 · 完整改造（换数据 + grill-me + 垂直深化）
| 案例 | 数据去向 | 垂直锚点 | 关键指标/术语 |
|---|---|---|---|
| **04 知识库 RAG** | 语料换 **CMRC2018**（848 篇中文百科上下文，真实检索语料） | 中文知识库检索 | 召回@k、命中率、忠实度、幻觉率 |
| **07 RAG 评测台** | gold 换 **CMRC2018 问答对**（3,219 真实中文 QA，确定性抽样为教学 gold） | 评测先行 EDD | hit@k、EM/F1、假绿三幕剧（复用现有） |
| **02 → P2P信贷·信用分层**（改造，非新增） | 换 **人人贷 P2P 借贷记录**（Harvard Dataverse，CC0-1.0，20,349 条真实**大陆** P2P 数据） | 大陆 P2P 信贷·借款人信用画像分层 + 放款转化 + HITL | 放款成功率、征信完整度分层、文案质量对转化、信用画像分层 |

> **case 02 改造**：航空会员 RFM（合成 `2-air_data.csv`）→ 大陆 P2P 信贷信用分层。净收益：**删一个合成集、增一个真实 CC0 大陆集**、案例数不变（无重编号）、**"分层"教学内核同构保留**（会员价值分层 → 借款人信用分层）。合成 `2-air_data.csv` 删除；真实 `2b-real_rfm.csv`（UCI 真算 RFM）保留供电商旗舰引用。
>
> **⚠️ 2026-07-13 两处修正**：(1) 台湾信用卡违约集已否决（用户要**中国大陆**）。(2) 干净可 vendored 的大陆真集里**没有"违约"标的**（魔镜杯/拍拍贷/天池违约集全部需账号+禁再分发）；唯一干净直连的大陆信贷真集是**人人贷（CC0）**，其标的列 `Success`=**放款成功**（非违约）。故案例标的从"违约预测"诚实重定为**"放款转化 + 信用画像分层"**——守住"真实数据"红线（合成违约会背离它）。`education` 保留为序数等级（数据字典未给学历名，**不臆造**）。**CMRC2018 不受影响**（大陆 HFL 简体基准）。

### B 档 · 轻量本地化（仅数据 + 红线标注）
| 案例 | 处理 |
|---|---|
| **01 / 03 / 05**（共用 `order_data.csv`） | UCI **真实数值不动**；`品类`→中国电商类目（家居/3C数码/美妆/服饰/食品生鲜/母婴/图书/运动户外/其他）、`区域`→中国省份、单价单位 £→¥ **本地化改写**。MANIFEST 标 **hybrid「真实数值效应 + 本地化改写实体标签」**，正文显式说明"实体标签为教学本地化，非 UCI 原始地理"。 |

## 数据集机制（零联网确定性 · 一次性 vendored）

**新增 `dataset/real/` 快照**（一次性下载、构建期零联网、sha256 入 MANIFEST）：
- `dataset/real/cmrc2018_dev.json` — 源 [ymcui/cmrc2018 SQuAD-style dev](https://github.com/ymcui/cmrc2018)（CC BY-SA-4.0）·3,299,139 B·sha256 `e9ff74231f05c230c6fa88b84441ee334d97234cbb610991cd94b82db00c7f1f`（**大陆 HFL，已确认可用**）
- `dataset/real/renrendai_p2p.csv` — 源 [Harvard Dataverse `doi:10.7910/DVN/C4RUDY`「P2P lending record from renrendai, china」](https://dataverse.harvard.edu/api/access/datafile/6157295)（CC0-1.0）·原始 xlsx 2,183,104 B / sha256 `a75a1498ef755235125a2c4a23a18078d67b0a4b8e83ab49bd9301077dd6caef`；一次性 stdlib 转 CSV（确定性、无随机），CSV sha256 入 MANIFEST。20,349 行 × 16 列，真实**大陆** P2P。列：`loan_id,Success,Amount(log),education,success records,credit limit(log),credit report,length,valid characters,ratio of valid characters,periods,ratio of complex words,theme 1..4`。标的 `Success`=放款成功（20.6%）。低 PII（匿名 loan_id）。

**`fetch-datasets.mjs` 新增两个块**（读快照 → 归一化为中文表头，零随机零联网）：
1. **P2P信贷** → `dataset/reference_data_analysis/p2p_credit.csv`，中文表头：`借款号,放款成功,借款金额,学历等级,历史成功次数,授信额度,有征信报告,描述字数,有效字符率,复杂词比例,主题1,主题2,主题3,主题4,信用画像`。派生（全真实、无合成）：`借款金额`=round(10^Amount(log))、`授信额度`=round(10^credit limit(log))、`有征信报告`=credit report(0/1→无/有)、`放款成功`=Success、`学历等级`保留序数（不臆造名）；`信用画像`= 规则派生分层标签（按 有征信×历史成功×额度 分「优质/成长/待观察/薄档」，**标注为规则派生、非事实标签**）。`periods` 为归一化异常值，**弃用**（避免误导）。
2. **RAG 语料 + gold** → `dataset/rag/corpus.jsonl`（848 上下文，字段 `{id,title,context}`）+ `dataset/rag/gold.jsonl`（确定性抽样 N=60 条 QA，字段 `{qid,question,answer,context_id}`，抽样规则：按 article 序取每篇首问、截前 60，可复现）。

**`order_data.csv` 本地化**：在现有生成块加两张**改写映射表**（英文类目→中国电商类目、UCI 国家→中国省份，确定性轮转分配），单价字段注释 £→¥（数值不变，仅单位语义）。MANIFEST 性质列改 hybrid 并加"本地化改写实体"说明。

## grill-me 苏格拉底追问

**现状**：`code/web/src/challenge.tsx`「你来决策」是一击定音单选（分派真实异常的责任人），答完即评对错。

**新增**：多步苏格拉底追问——答完立刻用"陷阱追问"检验是否真懂，答错→弹该误区为什么错→再深一层。

- **数据模型**：`case_definitions.json` 每 A 档案例加 `grill` 字段：
  ```
  grill: [ { q: "题干", options: ["A","B","C"], correct: 0,
             probe: { onWrong: "针对错答的追问文案（点破误区）",
                      onRight: "对答后的深化追问" } }, ... ]  // 2-3 步
  ```
  所有题锚在本案**真实数据/决策**上（沿用 challenge.tsx「数据真实、非编造」铁律；构建期校验存在性）。
- **组件**：新 `code/web/src/grill.tsx`（≈100 行）——多步对话，逐步揭示；答错显示 `onWrong` 追问再让重答/继续；完成计入"理解连击"成就（复用 `progress.ts` 的 markQuiz 机制，新增 grill 计数）。
- **测试**：`code/web/src/grill.test.ts`——断言：错答→`onWrong` 出现且不推进；对答→推进到下一步；末步→完成态；纯函数确定性。
- **文档侧**：每 A 档案例 markdown 加「## 被追问（grill-me）」段：问 → 常见错答 → 为什么错 → 真解。给读文档者同款 grill-me。

## 垂直深化（每 A 档案例）
- 真实行业 **KPI/术语表**（信贷：PD/逾期滚动率/账龄/授信集中度；RAG：召回@k/nDCG/忠实度/幻觉率；已在 KPI 链体现）。
- 一条锚在数据上的**失败实录**（信贷：拿历史违约直接训练 → 数据泄露/幸存者偏差、用违约率当因果；RAG：召回装载缺篇 → 假绿，复用现有三幕剧）。
- **成本/风险量级**一句。

## superpower 纪律（全程）
- **取数一次性联网**（已完成侦察下载，sha256 已验）→ vendored → 之后 build **零联网确定性**。
- **TDD**：每个改动先写失败测试 → 种错见红 → 实现 → 再绿；数据类改动"种错→verify 红→还原→再绿"。
- **新增 verify 守卫**（`verify_course_package.mjs`）：
  1. `dataset/real/` 每快照在 MANIFEST 有 source+license+sha256，且 sha256 与文件实际一致；
  2. A 档案例 `grill` 字段存在且每步 options 含 correct 下标、probe.onWrong 非空；
  3. 无"合成标真实"：credit_risk.csv / rag 派生物在 MANIFEST 性质列标注正确（real/hybrid/synthetic）。
- **三绿收口**：`verify_course_package` + `skill_lint` + `eval_harness`（CMRC gold 基线重算）+ `node --test`（diagram/data）+ `vitest`（web，含新 grill.test）。
- **红线**：CC BY-SA-4.0 署名 + share-alike 注明；CC0 公有说明；电商 hybrid 本地化标注；CMRC 无 PII、信贷匿名（无姓名，含 SEX/AGE/MARRIAGE 人口学，注明）。

## 交付物清单
1. `dataset/real/cmrc2018_dev.json`、`dataset/real/credit_taiwan.csv`（+ MANIFEST 条目 + sha256）
2. `fetch-datasets.mjs`：+信贷块、+RAG 语料/gold 块、order_data 本地化改写
3. `case_definitions.json`：04/07 → CMRC；02 → 信贷（改造）；01/03/05 本地化字段；A 档加 `grill`
4. `code/web/src/grill.tsx` + `grill.test.ts` + 接线进案例页（`screens.tsx`）
5. A 档案例 markdown「被追问」段 + 垂直 KPI/失败实录（经 build_docs 生成，改 case_definitions 驱动）
6. verify 三守卫 + MANIFEST 更新
7. 全量重建（build_case_data / build_docs / 必要重截）+ 三绿 + 提交 + 推送

## 不做（YAGNI）
- 不新增案例/章（case 02 为改造非新增）；不动 §1 aiagent 授权敞口；不接 Taobao（NC 许可 + 需账号 + 3.5GB）；不用 Kaggle "中国电商"合成陷阱集；grill 不做无限追问（固定 2-3 步）；不弱化任何守卫；不手改生成物。

## 风险与红线处置
- **CMRC share-alike**：仅教学引用、注明来源与许可，不商业再分发衍生；MANIFEST 记录。
- **电商本地化"借壳"风险**：必须标"实体标签本地化改写、数值为 UCI 真实"，绝不称中国类目/省份为原始事实——这是本轮最细的红线。
- **信贷人口学字段**：性别/年龄/婚姻为匿名人口学，无姓名/证件；正文提示"不得据此做歧视性决策"，呼应高影响行业人工复核。
