# v24 迭代 — 数据集丰富真实 + 场景细分 + 趣味回归内容 + Next.js + 技能体现

**日期**：2026-07-14（v23 之后）
**状态**：✅ 已批准（grill Q1-Q9 全确认）·执行中（P0→P5 分阶段，每阶段三绿+提交）

## 开放决策裁决（grill Q6-Q9 + 默认）
- **Q6 诚实缺口**：守红线——有干净真集的 6 案换/深挖；01/03 保留真实 UCI 基座+收紧细分+如实标注；10 工信部聚合真值锚+合成明细标红线。
- **Q7 案例04**：webMedQA（Apache·医疗健康问答·自带 1正4负金标）。
- **Q8 技能**：双管齐下——Next.js 前端真用 shadcn/ui（dogfood）+ pm_skills 加前端/设计工程技能卡 + 设计章扩充，部分检索补充。
- **C 案例08**：`gh api` 一次性抓取 vendored 快照（构建零联网），与所有真集一致。
- **E Next.js**：迁移须保三绿 + 截图边车（改 screenshot_cases/verify/run.sh）。
- **Q9 执行**：按 P0-P5 分阶段，每阶段独立三绿+提交。

## 执行计划 P0-P5
- **P0** 撤先猜再揭晓（趣味回归内容）。
- **P1** Vite→Next.js 迁移 + shadcn/ui 重构（10 案功能对等、保 node:sqlite、改截图/verify/run.sh）。
- **P2** 一次性联网抓取 vendored 6 真集 + 工信部聚合转录 + MANIFEST/sha256。
- **P3** 逐案细分+真集接线（02 首贷vs复贷 / 04 webMedQA / 05 空气质量大表 / 06 若依 pom+Feign / 08 DolphinScheduler / 09 nacos事件流 / 01·03 真基座收紧 / 10 运营商新案）。
- **P4** 技能体现（前端/设计工程技能卡 + 设计章 + 检索补充）。
- **P5** 收口：守卫/重截/三绿/合并 main/双推。

## 用户诉求（本轮累积）
1. 本地数据集要**丰富、真实**。
2. 现有正式场景要下钻到**领域内的细分需求**。
3. 趣味性在**案例本身**（内容锐利度），不是「先猜再揭晓」这类取巧 UI 花招——**非常严谨的教程**。
4. **运营商案例必须有**（可增案例），如「客户投诉升级」。
5. 前端 **Vite→Next.js**（保留 node:sqlite 后端）。
6. **各类技能**（shadcn/ui、UI/UX Pro 等）要在教程中体现；部分技能需检索网络资料补充。

## 已锁定决策（grill Q1-Q5）
- **Q1 趣味**：彻底撤掉先猜再揭晓；趣味=案例内容锐利度（真场景两难/反直觉真数据/真决策后果）；grill-me 保留。
- **Q2 范围**：全 9 案 + 新增运营商案（→10 案）。
- **Q3 dogfood**：06/08/09 也接外部真集，**补强**而非替换 dogfood。
- **Q4 取数**：业务类严格大陆真集；技术类允许国产开源/中文技术数据。许可须 CC0/CC-BY/公共领域可再分发、vendored 零联网、低 PII。
- **Q5 节奏**：一次性全案大迭代。

## 数据调研裁决（4 路并行 agent · 已核实 URL/许可）

| 案例 | 细分需求 | 真集裁决 | 许可 | 状态 |
|---|---|---|---|---|
| **01 电商异常** | 退货/取消异常预警 | 无干净大陆集 → 保留 UCI Online Retail II（**本就含真实退货信号**：发票 `C` 开头+负数量）收紧为退货异常 + 自建大陆大促/节假日 CC0 overlay | UCI CC BY | ⚠️ 诚实缺口 |
| **02 信贷** | **首贷户 vs 复贷户** 差异化放款 | 现有人人贷 CC0 深挖（`success records`=0 vs >0），**零新增下载、零许可风险** | CC0 | ✅ |
| **03 会员 RFM** | 复购挽回 | 无干净大陆替换 → 保留 UCI 派生 RFM，如实标注「暂无干净大陆替换」 | UCI CC BY | ⚠️ 诚实缺口 |
| **04 中文 RAG** | 垂直企业 KB | **webMedQA**（医疗健康问答，Apache-2.0，63k 问，自带 1正4负金标）；次选 baike2018qa（MIT，按 category 过滤单垂直）。**理想的电商售后 JDDC 锁死；Multi-CPR 内容理想但 license=null 判红** | Apache-2.0 | ✅ |
| **05 数据工程** | 大表查询优化 | **北京多站点空气质量**（UCI CC BY 4.0，**42 万行**，7.8MB 直链）；CROSS JOIN 自扩展讲「规模/复合索引/EXPLAIN」 | CC BY 4.0 | ✅ |
| **06 架构** | 分层边界/循环依赖/接口契约 | **若依 RuoYi-Cloud**（MIT）：解析 `pom.xml` `<modules>/<dependency>` → 模块依赖边 + `@FeignClient` → 服务接口契约边（vendored 仅 pom，几十 KB） | MIT | ✅ |
| **07 RAG 评测** | 随 04 | webMedQA 原生 P@1/hit@k（零改造）；或 T2Ranking（Apache，原生 qrels） | Apache-2.0 | ✅ |
| **08 研发效能** | 规格→实现→门禁 节奏/返工 | **apache/dolphinscheduler**（Apache-2.0）PR/issue/CI via `gh api`（**需 token**·较重）；备选 GH Archive 直下 | Apache-2.0 | ✅（含 token 依赖） |
| **09 事件溯源** | 大项目版本演进 vs 本仓库 | **alibaba/nacos**（Apache-2.0，10k+ commit）或 vuejs/core（MIT）：`git clone --filter=blob:none` + `git log` 限 release 区间 → 事件流（<1MB），与 dogfood 小流并置 | Apache/MIT | ✅ |
| **10 运营商（新）** | **客户投诉升级** | **无干净明细真集存在**（JDDC/黑猫/CnOpenData/天池 全禁再分发或 PII 或非投诉）。唯一干净真源=**工信部《电信服务质量通告》季度数据**（政府公开·聚合级：申诉分类占比/分运营商/处理及时率名单）→ 真值锚 + 合成明细工单（**显式标红线**） | 政府公开 | ⚠️ 聚合真+合成明细 |

**诚实缺口三处（关键红线）**：01/03 无干净大陆替换（保留真实 UCI 基座+如实标注）；10 运营商只有聚合真值（明细合成需标注）。**绝不为「大陆」二字踩许可雷（淘宝行为集全禁再分发）或把合成说成真实。**

## 待 grill 的开放决策
- **A 诚实缺口处置**（01/03/10 无干净大陆明细真集怎么办）——最关键红线决策。
- **B 案例04 语料**（webMedQA 医疗 vs baike 泛+category 过滤；电商售后已锁死）。
- **C 案例08 token 依赖**（gh api 需 token 破坏「零联网构建」——改一次性抓取 vendored 快照？）。
- **D 技能体现范围**（shadcn/ui + UI/UX Pro 等：作为技能卡/章节内容 + 真在 Next.js 前端用 shadcn 落地？哪些技能？哪些需检索补充？）。
- **E Next.js 迁移与三绿/截图管线**（Vite→Next 后 verify/screenshot_cases/run.sh 全要改）。

## 执行进度（branch `v24-datasets-nextjs-skills`，未推送）
- ✅ **P0** 撤先猜再揭晓（`2e40841`）。
- ✅ **P1 工具链** Next.js14+Tailwind+shadcn 安装（`88d991d`，Vite 仍为主）。
- ✅ **P2 真集抓取 5/6**（各已 vendored+MANIFEST+sha256+verify 绿）：
  - `94acca8` 06 若依 RuoYi-Cloud arch（22 模块/28 边/0 环/3 Feign，MIT）
  - `cdcbd38` 09 nacos 事件流（600 事件/298 天/父指针，Apache）
  - `446c5ba` 04/07 webMedQA（120 组 1正4负 医疗金标，Apache）
  - `989a286` 05 北京空气质量（140256 行/12 站，CC BY 4.0）
  - `c3f9c33` 08 海豚调度 devops（CI 89.1%/PR 51%，Apache）
- ⏳ **P2 剩 1/6**：**案例10 运营商工信部数据**——WebFetch 对 .gov.cn/镜像全部 socket 关闭（地域封锁），仅有 2 个已核实季度（2021Q3=36199件·57.7/24.8/17.5%；2020Q2=37543件）。需专门转录多份通告的研究通道；不足则以少量真值+合成明细（标红线）建案。
- **顺序调整**：用户定 P2/P3 内容先于 P1 迁移（先在 Vite 上落地内容，迁移只做一次）。
- ✅ **反思清理**（用户要求先反思再推进）：修 3 真 bug——若依依赖边解析误算 dependencyManagement（28→18 真实边）、死 three 依赖、**v23 遗留活体门禁 hit@3→hit@1 回归（gates.ts 正则未跟标签变更→evalGate.score 静默 null）**；+ 守卫⑨ 防标签漂移。
- ✅ **P3 接线 5/9**（各三绿+提交，真集接进 case + 屏 + def + 守卫 + 重截）：
  - `efdd60e` 06 若依真实架构对照（22模块/18边/0环/3Feign，小 dogfood vs 大项目）
  - `257a8c9` 09 nacos 事件流对照（600 vs 本仓库 123）
  - `c03ec73` 05 北京空气 14 万行大表（SCAN→SEARCH·NA/CRLF 已清）
  - `e7ae98b` 08 海豚调度研发效能对照（CI 89.1%/PR 51%·完成 dogfood 对照三案）
  - `71799eb` 02 新客 vs 复借细分（实测历史成功 min=1，按真实切分不臆造「首贷=0」；复借放款率 70.3%≫新客 17.8% 印证规模混淆）
- ⏳ **P3 剩 4**：**04/07 webMedQA 替换 CMRC（大改·清 848 语料+corpus/gold/store/lab/eval 重建，big-bang 宜专注做）** · 01 退货（v23 已含 base-rate beat，refine 轻） · 03 复购（v23 已接真 RFM，refine 轻） · 10 运营商（工信部聚合真值受限+合成明细）。
- ⏳ **后续**：P1 Next.js+shadcn 迁移 → P4 技能体现 → P5 收口双推。分支 15 commits 全绿未推送。

## 纪律（延续 v23）
真实/本地化改写/合成三类显式区分；绝不把合成/派生说成真实，**也绝不把真实说成合成**；vendored 零联网确定性；TDD + 三绿 + 分批提交；不弱化守卫。
