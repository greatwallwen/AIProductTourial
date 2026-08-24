# 课程 Skill Map（逻辑闭环版）

> 目标：用**逻辑闭环**串联课程"逻辑基础→Agent/Skill 工程→数据可视化→交付治理"全链路
> 更新：2026-08，整合 cangjie-skill-main 逻辑底层 + S01-S09 案例 + B01-B20 章节适配

**编写规范**：每个 Skill 按"触发条件 / 输入 / 澄清问题 / 核心能力 / 验收标准 / 复用范围"六槽结构化，发布前经 `skill_lint`（skill-scanner）扫描——检查路由完整性、样本可复算、安全注入、版本一致性。逻辑底层 skill 由 cangjie-skill-main 把逻辑学方法论 skill 化；工程层 skill 优先采用 GitHub 开源 Skill（克隆到 `skills/<name>-main/` 方便离线使用），课程保留实际采用的触发条件、输入输出、许可和测试；交付治理层 skill 守护"能不能发"的最后一道关卡。三层之间不是堆叠，而是**逻辑闭环**：逻辑底层提供方法论锚点 → supergrill 做选型前证伪式拷问 → 执行层产出工件 → 治理层验收，每条案例都可追溯到逻辑底层某个 skill。

---

## 一、设计理念：从"视觉交付"到"逻辑闭环"

AIGC 版 Skill Map 覆盖 9 个视觉生成 Skill，解决"分析结论→视觉作品"。课程版做转换——**以 cangjie-skill-main 蒸馏的 15 个逻辑 skill 为底层，supergrill 为方法论内核**，把 Agent/Skill 工程（S01-S08）、数据可视化（B02 统计图表 + B20 C4 架构图 + S09 动态架构图）、交付治理（B05 TDD / B16 multi-agent-review）串成一条**逻辑闭环**：每个 Skill 对应课程具体章节，每个案例可追溯到逻辑方法论。

```
┌──────────────────────────────────────────────────────────────────┐
│  cangjie-skill-main（逻辑底层 · 15 个逻辑 skill）                │
│  命题清晰化→归纳三前提→全集子集→参照系→相关≠因果→证伪→边界守护  │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  supergrill（方法论内核 · 证伪式拷问 + 项目治理）                    │
│  grill-me 决策访谈 + superpowers 治理门控 → 逼出假设 → 决定用哪个 Skill │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  A. Agent/Skill 工程层  ← S01-S08（分诊/体检/简报/机会图/          │
│     海报/PPTX/PixiJS/3D）                                         │
│  B. 数据可视化层        ← lieflat-charts（B02 统计图表）           │
│                         + drawio-skill（B20 C4 架构图）            │
│                         + Archify（S09 动态架构图）                │
│  C. 交付治理层          ← test-driven-development（B05）           │
│                         + multi-agent-review（B16）                │
│                         + skill_lint（skill-scanner）             │
└──────────────────────────────────────────────────────────────────┘
    数据流：逻辑底层 → supergrill 选型 → A-C 层执行 → 交付治理验收
```

---

## 二、Skill 清单（15 逻辑底层 + 1 方法论 + 14 工程/治理）

### 逻辑底层（cangjie-skill-main · 15 个逻辑 skill）

> 位于 `tmp/books/逻辑思维训练50讲/skills/`，由 cangjie-skill-main 把逻辑学制作成 skill。

| # | Skill | 核心能力 | 课程关联 |
|---|---|---|---|
| L1 | proposition-clarification | 模糊表述→可验证命题 | 01 章逻辑证据 |
| L2 | induction-three-prerequisites | 归纳可靠性三前提（相关/参照/数据量） | 01 章归纳 |
| L3 | universe-subset-distinction | 全集/子集辨析，防辛普森悖论 | B16 风机下偏 |
| L4 | reference-frame-selection | 参照系可比性检查 | B14/B18 |
| L5 | correlation-not-causation | 阻断相关→因果跳跃 | B02 发券实验 |
| L6 | falsification-thinking | 可证伪性检查，找反例 | 11 章 TDD |
| L7 | logic-boundary-guard | 证据不足悬置判断，交人工 | S01 分诊停止 |
| L8 | quantifier-rigor | 全称/存在量词严谨 | B17 切刀 |
| L9 | logic-consistency-conditions | 条件要素偷换检查 | B14 浮选 |
| L10 | induction-exception-warning | 归纳结论例外提醒 | B15 半导体 |
| L11 | identity-law-check | 概念指代一致性 | 13 章六槽 |
| L12 | exclusivity-possibility-analysis | 结论强度分类（必然/可能/排他） | B19 液压 |
| L13 | logic-three-step | 命题化→逻辑关系→链条 | 01 章推理 |
| L14 | fact-opinion-separation | 事实/观点分离 | S03 简报 |
| L15 | spdc-method | State/Plan/Do/Conclude 四步 | 数据分析 |

### 方法论内核

| # | Skill | 来源 | 核心能力 | 课程关联 |
|---|---|---|---|---|
| 0 | **supergrill** | [greatwallwen/supergrill](https://github.com/greatwallwen/supergrill/)（superpowers + grill-me 结合） | 以 grill-me 为决策访谈权威，叠加硬门控/检查点/方法论感知/自适应模型路由/跨项目学习，将不确定项目转化为基于事实、可恢复、成本感知的执行循环 | 选型前对方案做证伪式压力测试 + 项目治理门控 |

### A. Agent/Skill 工程层（S01-S08 · 对应 03-Agent与Skill工程.md）

> 开源 Skill 只作结构参考；课程保留实际采用的触发条件、输入输出、许可和测试。

| # | Skill | 案例 | 参考来源 | 核心能力 |
|---|---|---|---|---|
| 1 | capability-router | S01 分诊 | openai/skills（结构参考） | 先检查输入齐全与动作允许，缺输入或越权时停止 |
| 2 | data-profile | S02 数据体检 | openai/skills（结构参考） | 只读完整扫描，生成 JSON+MD 体检报告 |
| 3 | metric-brief | S03 会员简报 | deanpeters/Product-Manager-Skills（问题框定参考） | 计算指标+经营简报，保留"不可计算"格子 |
| 4 | product-opportunity-map | S04 机会图 | deanpeters/Product-Manager-Skills（问题框定参考） | 原话→机会图，每节点带 source_refs |
| 5 | poster-recipe | S05 海报 | LiamGvchi/gc-minimal-zine-poster（视觉配方参考） | 三套不同方向+本地可编辑 SVG |
| 6 | slide-plan | S06 PPTX | tristan-mcinnis/pptx-from-layouts-skill（模板布局参考） | 大纲→可编辑 PPTX+逐页备注+检查 |
| 7 | pixijs-game-contract | S07 PixiJS | pixijs/pixijs-skills（PixiJS v8 参考） | 键盘控制+倒计时+重启+资源释放 |
| 8 | asset-contract | S08 3D | DeemosTech/rodin3d-skills（3D 资产参考） | 格式/性能预算检查+Three.js 查看器 |

### B. 数据可视化层

> 三个 Skill 本质相同——把数据/结构可视化成图表，只是数据类型不同：lieflat-charts 可视化统计数据，drawio-skill 可视化系统架构，Archify 可视化案例流程动态。

| # | Skill | 案例 | 来源 | 核心能力 |
|---|---|---|---|---|
| 9 | lieflat-charts | B02 单色图表 | larashero3-dotcom/lieflat-charts | 单色编辑叙事 HTML 图表，面向 AI Agent |
| 10 | drawio-skill | B20 C4 四层图 | Agents365-ai/drawio-skill（5.4k star） | 自然语言→.drawio 架构图，6 预设，视觉自检，导出 PNG/SVG |
| 11 | Archify | S09 案例动态图 | tt-a1i/archify（MIT，v2.13.0，克隆至 `skills/archify-main/`） | 静态 SVG→trace 动画 gif/webm，JSON IR→交互 HTML |

### C. 交付治理层

| # | Skill | 案例 | 来源 | 核心能力 |
|---|---|---|---|---|
| 12 | test-driven-development | B05 转运单校验 | jnMetaCode/superpowers-zh（7.5k star，单卡） | 红绿重构协议，任一步跳过即视为未完成 |
| 13 | multi-agent-review | B16 风机评审 | harish-info/claude-code-skills | Review Board：3 agent 并行审，Tech Lead 汇总 |
| 14 | skill_lint | 13 章治理 | skill-scanner（13 章引用） | Skill 发布前四类检查：路由/样本/安全/版本 |

> 以上 30 个 Skill 分属三层，但清单只是目录——真正的价值在**逻辑闭环**：每个工程 Skill 执行时，逻辑底层 skill 在方法论上把关，supergrill 在选型前拷问，治理层在产出后验收。以下 10 条主线展示闭环怎么跑。

---

## 三、逻辑闭环案例（10 条主线）

> 每条主线：**逻辑底层 skill → supergrill 选型 → 工程 skill 执行 → 交付治理验收**

### 主线 1：B02 会员发券 → lieflat-charts 单色图表（01 章）

**逻辑链**：L5 相关≠因果 → L14 事实/观点分离 → supergrill 拷问"图表是否暗示因果" → lieflat-charts 出图 → L7 边界守护挂起判断

**闭环**：B02 发券组购买次数高于对照组（共变线索）→ lieflat-charts 画成单色图表，标注"已确认/可计算/待验证"三态 → supergrill 拷问"分配是否随机？观察窗是否统一？" → 证据不足，L7 触发悬置，把因果判断交由实验/人工 → 串起 01 章"统计→可视化→悬置"三节。

**Prompt 要点**：不把相关性画成因果；组间差异只标"共变线索"，不标"券起效"；每个数据点标注来源字段和口径。

### 主线 2：B20 光伏归因 → drawio-skill C4 四层图（05 章）

**逻辑链**：L3 全集/子集辨析 → L4 参照系选择 → supergrill 拷问"边界是否划清" → drawio-skill 画 C4 → L11 同一律检查 status 字段歧义 → DDD 衔接

**闭环**：B20 光伏站端记录核查台 → drawio-skill 画 C4 四层（Context/Container/Component/Code）→ 画到 Container 层暴露"命令服务"与"工作台"职责重叠 → L11 发现 `status` 字段在事件记录与站日事实存储里被解释成不同含义（偷换概念）→ supergrill 拷问"边界没划清" → 正是下一节 DDD 要解决的：限界上下文划清边界、防腐层阻止外部含义渗入 → C4 暴露问题，DDD 给解法，两节衔接。

**已完成**：四张 SVG + .drawio 源文件 + 运行案例 md 均已生成（2026-08-06）。

### 主线 3：S09 案例动态图 → Archify trace 动画（03 章）

**逻辑链**：L13 逻辑三步法（命题化→关系→链条）→ supergrill 拷问"静态图能否看出流程方向" → Archify 渲染 → L9 逻辑一致性检查 trace 顺序

**闭环**：B01-B20 共 40 张静态 SVG（需求流程+技术架构）→ Archify 把 JSON IR 渲染成交互 HTML（含 trace 动画、play/replay/showAll）→ puppeteer 录屏+ffmpeg 编码 webm → L9 检查 trace 顺序与案例逻辑一致 → 读者一眼看到"谁先动、数据往哪流、哪一步是关键判断"。

**三步管线**：① gen-json.mjs 生成 JSON IR → ② deliver-all.mjs 调 archify render → ③ make-webm.mjs 调 puppeteer+ffmpeg。换案例只需换 JSON，不动渲染代码。

### 主线 4：B05 医院转运 → test-driven-development（11 章）

**逻辑链**：L6 证伪思维 → supergrill 拷问"已知反例是否消除" → TDD 红绿重构 → L10 归纳例外提醒"未知缺陷仍存在" → 4.4 健壮与安全补护栏

**闭环**：B05 转运单缺患者ID → TDD 先写红测试"缺ID时返回 patient_id_required" → 绿测试消除已知反例 → L6 证伪：先写断言=先构造反例条件再消除 → supergrill 拷问"TDD 能保证没有未知缺陷吗？" → L10 提醒：TDD 只保证"已知反例被消除"，不保证"没有未知缺陷"（并发提交、权限绕过）→ 正是 4.4 健壮与安全要补的：错误处理+安全红线 → TDD 是证伪第一道，健壮与安全是第二道。

### 主线 5：B16 风机欠发 → multi-agent-review（12 章）

**逻辑链**：L3 全集/子集辨析 → L11 同一律（Maker/Checker 不能同一）→ supergrill 拷问"验的人是否独立于做的人" → multi-agent-review 三 agent 并行审 → L7 边界守护把问题清单交门禁

**闭环**：B16 风机欠发代码 → multi-agent-review 以 Review Board 模式审（3 独立 agent 并行，Tech Lead 汇总）→ 三视角：工程（指标可计算？硬编码？）/判断（因果成立？异常有责任人？）/验证（3 条可自动核对断言）→ L11 同一律：Maker/Checker 分离不是口号，Review Board 让"验的人"真的独立于"做的人" → supergrill 拷问"问题清单如何变成门禁？" → 审查输出正是 5.4 风险登记的输入：把问题写成可自动检测的守卫 → "能不能发"从拍脑袋变成可核对关卡。

### 主线 6：B01 零售售后 → capability-router 分诊（03 章）

**逻辑链**：L1 命题清晰化 → L8 量词严谨性 → supergrill 拷问"取消单是否等于已退款" → capability-router 分诊 → L7 边界守护挂起判断

**闭环**：B01 取消单原单核对 → capability-router 先检查输入齐全与动作允许 → L1 把"取消单已生成"与"退款已到账"拆成两个可验证命题 → L8 量词："所有取消单都退了款"需反例检验 → 证据不足时 L7 悬置，把"是否退款"交人工核对 → 串起 03 章分诊停止条件。

**Prompt 要点**：取消单号存在≠退款已完成；每个状态标注"已生成/已退款/待核对"三态。

### 主线 7：B03 餐饮评论 → data-profile 数据体检（03 章）

**逻辑链**：L14 事实/观点分离 → L6 证伪思维 → supergrill 拷问"差评是否等于菜品问题" → data-profile 数据体检 → L8 量词严谨性

**闭环**：B03 餐饮评论问题调查 → data-profile 扫描评论数据 → L14 把"菜品难吃"（观点）与"差评率 23%"（事实）分离 → L6 证伪："所有差评都因菜品质量"找反例（服务慢、等位久）→ L8 量词："大部分差评"需界定范围 → 串起 S02 数据体检的"只读完整扫描"。

**Prompt 要点**：差评率是事实，原因是观点；不把"差评多"等同于"菜品差"。

### 主线 8：B07 即时零售 → metric-brief 经营简报（03 章）

**逻辑链**：L5 相关≠因果 → L1 命题清晰化 → supergrill 拷问"履约慢是否导致流失" → metric-brief 经营简报 → L7 边界守护

**闭环**：B07 即时履约架构评审 → metric-brief 计算履约时长与复购率 → L5 共变线索：履约慢的订单复购率低，但不等于"慢导致流失"（可能客单价高的人既慢又流失）→ L1 命题化："履约时长与复购率负相关"（可验证）≠"履约慢导致流失"（需实验）→ L7 证据不足悬置，把因果判断交 A/B 实验 → 串起 S03 经营简报的"不可计算"格子。

**Prompt 要点**：相关是线索不是结论；共变标注"线索"，不标"原因"。

### 主线 9：B09 地铁空压机 → Archify 动态图（03 章）

**逻辑链**：L9 逻辑一致性 → L6 证伪思维 → supergrill 拷问"不同工况数据是否混算" → Archify 动态图 → L7 边界守护

**闭环**：B09 地铁空压机检索辅助排查 → Archify 渲染故障 trace 动画 → L9 检查不同工况（高峰/平峰/夜间）的振动数据是否被混算均值 → L6 证伪："所有高峰振动异常都因空压机故障"找反例（轨道颠簸）→ L7 振动数据只到传感器级，不到设备级，悬置"设备故障"判断 → 串起 S09 动态图的 trace 顺序检查。

**Prompt 要点**：不同工况数据不能混算均值；振动异常是线索，设备故障是判断。

### 主线 10：B11 模型准入 → multi-agent-review（12 章）

**逻辑链**：L6 证伪思维 → L3 全集/子集辨析 → supergrill 拷问"补测样本是否代表全集" → multi-agent-review → L2 归纳三前提

**闭环**：B11 企业模型准入补测 → multi-agent-review 三 agent 并行审 → L6 证伪："补测全绿=模型可用"找反例（边缘 case 未覆盖）→ L3 全集/子集：补测样本是子集，不能代表全集性能 → L2 归纳三前提：相关性（补测绿与上线绿）、参照系（补测集与生产集同分布？）、数据量（补测样本够？）→ 串起 12 章交付治理的 L0→L3 分级。

**Prompt 要点**：补测全绿是子集证据，不等于全集可用；归纳需三前提同时满足。

> 10 条主线跑通后，每个 Skill 的来源、许可、star 都需要核实——开源 Skill 克隆到本地不等于拥有，课程保留的是实际采用的触发条件、输入输出和测试。以下来源表供核实。

---

## 四、Skill 来源说明

| Skill | 仓库/位置 | star | 用途 |
|---|---|---|---|
| cangjie-skill-main（15 逻辑 skill） | `tmp/books/逻辑思维训练50讲/skills/` | — | 逻辑学方法论 skill 化 |
| supergrill | [greatwallwen/supergrill](https://github.com/greatwallwen/supergrill/) | — | superpowers + grill-me 结合：证伪式决策访谈 + 项目执行治理框架 |
| lieflat-charts | larashero3-dotcom/lieflat-charts | — | 单色数据可视化，编辑叙事 HTML 图表 |
| drawio-skill | Agents365-ai/drawio-skill | 5.4k | 自然语言→.drawio 架构图，6 预设，视觉自检 |
| test-driven-development | jnMetaCode/superpowers-zh（单卡） | 7.5k（套件） | 红绿重构协议 |
| multi-agent-review | harish-info/claude-code-skills | — | Review Board：3 agent 并行审 |
| Archify | tt-a1i/archify（MIT，v2.13.0） | — | 静态 SVG→trace 动画 gif/webm，克隆至 `skills/archify-main/` |
| capability-router | 课程自有 | — | S01 分诊 |
| data-profile | 课程自有 | — | S02 数据体检 |
| metric-brief | 课程自有 | — | S03 经营简报 |
| product-opportunity-map | 课程自有 | — | S04 机会图 |
| poster-recipe | 课程自有 | — | S05 海报配方 |
| slide-plan | 课程自有 | — | S06 PPTX |
| pixijs-game-contract | 课程自有 | — | S07 PixiJS 原型 |
| asset-contract | 课程自有 | — | S08 3D 资产检查 |
| skill_lint | skill-scanner（13 章引用） | — | Skill 发布前四类检查 |

> 开源参考来源（skills-research-card.json）：openai/skills（结构）、deanpeters/Product-Manager-Skills（问题框定）、LiamGvchi/gc-minimal-zine-poster（视觉配方）、tristan-mcinnis/pptx-from-layouts-skill（模板布局）、pixijs/pixijs-skills（PixiJS v8）、DeemosTech/rodin3d-skills（3D 资产）。课程保留实际采用的触发条件、输入输出、许可和测试。

---

## 五、执行顺序建议

1. **先装逻辑底层**：cangjie-skill-main 15 个逻辑 skill + supergrill，作为所有案例的方法论锚点
2. **再做数据可视化**：lieflat-charts 把 B02 统计数据做成单色图表 + drawio-skill 画 B20 C4 四层（已完成）+ Archify 做 S09 动态图（B01-B20 共 40 张）
3. **再做交付治理**：test-driven-development 给 B05 写转运单校验 + multi-agent-review 审 B16
4. **最后整合**：把 10 条逻辑闭环主线的"结果图待补充"项逐一补齐，链接回本文档

> 执行顺序不是线性瀑布——每一步都要回到逻辑底层：装逻辑底层是为了给后续每一步当方法论锚点，做数据可视化时 L3/L4/L5/L11/L14 在把关（架构图查边界、统计图表查因果），做交付治理时 L6/L10 在把关。装一层、跑一条闭环、再装下一层，是推荐的节奏。
