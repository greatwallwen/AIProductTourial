# 通用 Skill 案例：开发与设计

开发类任务不是把“做得高级”翻译成更多动画。页面先要承载真实数据和操作，再决定流程 Skill、UI Kit 或现成地图模板能帮到哪一层。本章先看两个任务的交付要求，再分别读工作台与三维地图的完整案例；源码与运行回执仍保留在各自产物位置。

## 先把“能用”说具体

| 任务 | 使用者要完成什么 | 现有案例和成果 | 这次要比较什么 |
|---|---|---|---|
| 通信请求恢复核查工作台 | 查证调用链、记录结果，不把没有回执误判成成功或失败 | [S10：Prompt、Skill 与 UI Kit 的分工](#skill-s10)：B10 数据切片、两份实际页面、状态门与浏览器回执 | Prompt 写需求，Skill 管流程，UI Kit 管外观；各自到底贡献了什么？ |
| 中国地图下钻入口 | 看省级要素，进入浙江市级，再回到全国 | [S11：真实 GeoJSON 与 Three.js 地图](#skill-s11)：真实数据、手写 WebGL 与 Skill 模板、桌面和手机检查 | 轻量实现和完整地图模板，分别值得付出多少成本？ |

如果任务只是一个可键盘控制的原型、3D 资产检查或流程图动效，还可以接着读 [Skill 章的 S07—S09 实验](../02-能力篇/05-Skill工程-结构发布与治理.md)。选型前先想清楚：使用者要做什么、事实来自哪份数据、哪些状态必须区分、怎样亲手核查。不要把 Skill、UI Kit 或模板当作业务决策的替身。

<a id="skill-s10"></a>

## S10：查询发出却没有回执，工作台该显示什么？

> 固定数据：`dataset/10-telecom-complaint-orchestration/case.csv`  
> 实测日期：2026-09-17  
> 结论边界：A/B 只保存完整 Prompt，不冒充独立模型运行；C/D 为本地实际生成页面，并完成桌面、手机、键盘和状态切换检查。

### 场景与任务

工作人员要核查一条通信请求：本地任务已登记，查询也发出去了，外部效果却还没有回执。工作台若为了看起来“完成”而把它写成已生效或未生效，就把未知改成了结论。“做一个好看的后台”没有说明业务任务、状态、证据边界和验收方式。结构化 Prompt 能把需求说清楚，Skill 能把工作流和检查步骤固定下来，UI Kit 能统一组件外观；三者不是同一种东西，也不能互相替代。

本实验复用 B10 的 1,000 条匿名课程数据，不另编业务故事。页面任务固定为“通信请求恢复核查”：工作人员可以查看调用链和证据，记录“仍未知 / 已生效 / 未生效”，但不得把缺少外部回执误写成失败或成功。

### 四组怎样比较

| 组 | 唯一变化 | 当前证据 |
|---|---|---|
| A 普通 Prompt | 只有“做一个好看的通信投诉后台” | [完整 Prompt](../../assets/S10/prompts/A-ordinary.txt)，未做独立模型调用 |
| B 结构化 Prompt | 补齐布局、状态、响应式、可访问性和禁止项 | [完整 Prompt](../../assets/S10/prompts/B-structured.txt)，未做独立模型调用 |
| C `ui-workbench` Skill | 用固定工作流、状态矩阵和浏览器验收生成页面 | [实际页面](../../assets/S10/skill-only/index.html) |
| D `ui-workbench` + Tabler | 保持 C 的内容和交互，只增加固定版本 UI Kit | [实际页面](../../assets/S10/tabler/index.html) |

A/B 可以比较“指令写进了什么”，却不能比较“页面谁更好”：这两组没有独立生成页面。C/D 才有可打开、可操作的结果。

### Skills 介绍：流程 Skill 和 UI Kit 的边界

课程自有 [`ui-workbench`](../../code/skills/ui-workbench/SKILL.md) 不是一段“让页面更高级”的形容词，而是一套可重复执行的合同：先读数据和禁止结论，再定义队列、记录、证据、决策和完成门；随后补齐空白、待核对、明确结果、禁用和错误状态；最后做键盘、手机、控制台和水平溢出检查。

它由 Skill Creator 初始化并在本项目内实现，不是从 GitHub 冒充下载的第三方 Skill。生成器使用 Python 标准库，输入受 `--allowed-root` 限制，不修改源 CSV。D 组另加 Tabler 组件样式；Tabler 是 UI Kit，不负责规定业务状态。

### Prompt：四组保存的输入

以下为四组保存的原始输入。先读它们怎样提出任务，再对照下方的实际页面与验收记录。

**A：普通 Prompt**

```text
做一个好看的通信投诉后台。
```

**B：结构化 Prompt**

```text
基于 B10 通信请求恢复核查，做一个桌面优先且可响应的后台工作台。左侧是可搜索、可按三种场景筛选的匿名任务目录；中间显示本地记录、网络边界、外部效果三段调用链和证据矩阵；右侧记录查询目标、说明、仍未知/已生效/未生效、结果摘要和证据编号。必须包含空白、禁用、待核对、明确结果和错误提示状态，键盘可达，手机端不得水平溢出，不得生成个人信息或虚构外部结果。
```

**C：流程 Skill**

```text
使用 $ui-workbench 读取 dataset/10-telecom-complaint-orchestration/case.csv，按其工作流、状态矩阵、可访问性和浏览器验收规则生成 B10 工作台；不加载外部 UI Kit。
```

**D：流程 Skill + Tabler**

```text
使用 $ui-workbench 读取同一 B10 数据和交互合同，并使用固定版本 @tabler/core@1.4.0实现按钮、徽标、卡片和表格；不得把 Tabler 写成 Skill，保持与 C 组相同功能和文案。
```

逐字输入另存于 [`assets/S10/prompts/`](../../assets/S10/prompts/)。

### 运行结果：数据与状态不是装饰

构建器只读扫描 CSV，得到 1,000 条记录和三种场景分布：响应丢失 333 条、效果未知 333 条、尚未提交 334 条。代表任务为 `CN-TEL-2025Q2-0008`，地区显示为福建福州。

页面把事实、未知和动作分开：

- 本地任务已登记，可以陈述；
- 查询发出后未取得响应，可以陈述；
- 外部效果未知，不能推断成失败；
- “仍未知”必须填写原因；
- “已生效 / 未生效”必须同时填写结果摘要和证据编号；
- 演示按钮只更新页面状态，不向任何外部系统发请求。

![Skill-only 桌面工作台](../../assets/S10/browser-check/skill-only-desktop.png)

### 加上 Tabler 之后，哪里变了

D 组使用 `@tabler/core@1.4.0` 的官方 CSS。项目副本与官方 npm tarball 逐字节一致，SHA-256 为 `7ef750bd10546a695d0b12767ad8048bd8f3ec5de7daefb1067f9d0daa3d1c9a`；同时核对了 GitHub 仓库 `tabler/tabler` 的 commit `b295d84b3eb57b05003ba155f4da925be71f1214` 和 MIT 许可证。

Tabler 是 UI Kit，不是 Skill。它没有决定“外部效果未知时要停下来”，也没有替页面补齐证据门槛；这些来自 Skill。它实际改善的是按钮、徽标、边框、表格和间距的一致性，代价是额外引入 536,141 字节 CSS。

![Tabler 桌面工作台](../../assets/S10/browser-check/tabler-desktop.png)

### 真实浏览器怎样核对

两份页面用同一套交互脚本验收，结果一致：

| 检查 | C Skill-only | D Skill + Tabler |
|---|---|---|
| 初始“响应丢失”可见项 | 3 | 3 |
| 切换“效果未知”后 | 3 | 3 |
| 搜索 `0003` 后 | 1 | 1 |
| 空表单记录按钮 | 禁用 | 禁用 |
| “仍未知 + 原因” | 可保留待核对 | 可保留待核对 |
| 明确结果但无证据 | 仍禁用 | 仍禁用 |
| 补齐证据编号 | 可记录 | 可记录 |
| 首个 Tab 焦点 | `skip-link` | `skip-link` |
| 1440×900 / 390×844 页面横向溢出 | 0 / 0 | 0 / 0 |
| 控制台 error | 0 | 0 |

手机端把三区工作台改成纵向任务流；宽表格只在自己的容器内横向滚动，不让整个页面溢出。截图左上角出现“跳到核查工作区”，是键盘验收时获得焦点的跳转链接，不是版式故障。

手机端两组仍可操作，但版式不同。对照图片看三区工作台缩窄之后，任务、证据和记录按钮是否还能按顺序找到：

![C 组 Skill-only 手机工作台](../../assets/S10/browser-check/skill-only-mobile.png)

![D 组 Skill 与 Tabler 手机工作台](../../assets/S10/browser-check/tabler-mobile.png)

### 结论与课堂选择

Prompt 负责表达需求，但它不会自动保证执行者逐项验收；Skill 固定流程、状态和证据边界；UI Kit 提供成熟组件样式；模型或 Agent 负责读取这些约束并生成工件。

C 和 D 的业务正确性相同，说明 UI Kit 没有让业务规则“更聪明”。D 的视觉一致性更好，但多出约 523 KiB 依赖。对一次性离线演示，C 更轻；对需要持续扩展且已有 Tabler 设计体系的后台，D 更容易保持组件一致。

**课堂提问：**已发出查询，却没有外部响应；能否直接点“未生效”？如果想记录“已生效”，只写一段摘要够吗？**参考答案：**没有回执时仍是未知；记录明确结果必须同时给摘要和证据编号。先用 [C 组页面](../../assets/S10/skill-only/index.html)验证，再在 [D 组页面](../../assets/S10/tabler/index.html)重复。组件风格可以不同，但状态门不能变化。

### 不用 API Key，怎样复跑

本实验是本地 CSV、Python 生成器、静态 HTML 和浏览器检查，没有调用云模型或外部业务接口，因此不需要 API Key：

```bash
python3 -B code/skills/ui-workbench/scripts/build_ui_comparison.py \
  --input dataset/10-telecom-complaint-orchestration/case.csv \
  --allowed-root dataset/10-telecom-complaint-orchestration \
  --tabler-css vendor/tabler/1.4.0/tabler.min.css \
  --output-dir assets/S10
```

生成回执见 [receipt.json](../../assets/S10/receipt.json)，浏览器回执见 [browser-verification.json](../../assets/S10/browser-check/browser-verification.json)。

<a id="skill-s11"></a>

## S11：地图看起来立体，真的能进入浙江吗？

> 数据来源：DataV 行政区边界公共接口  
> 实测日期：2026-09-17  
> 结论边界：只展示行政区边界、hover 和下钻，不把 B20 光伏数据虚构映射到省市。

### 场景与任务

展示中国地图时，把一张图片倾斜、加上阴影，就能做出立体感。可如果观众要把鼠标放到浙江、点进去看市级边界，再返回全国，图像的厚度就不等于交互能力。这次从已保存的真实 GeoJSON 出发，比较一张视觉草图、轻量 Three.js 实现与外部 Skill 的完整模板。先定义“真三维”的检查条件：页面确有 WebGL canvas，能 hover、下钻和返回，再讨论材质与飞线值不值得增加。

### 三组怎样比较

| 组 | 实际实现 | 当前产物 |
|---|---|---|
| A CSS 伪 3D | JPG 倾斜、阴影和假厚度 | [A 组页面](../../assets/S11/A-css-fake/index.html) |
| B 普通 Prompt 手写 | Three.js 读取真实 GeoJSON，生成挤出几何 | [B 组页面](../../assets/S11/B-three/index.html) |
| C GitHub Skill | `three-scope-map` 固定 Vue/Three.js 模板 | [C 组源码与构建配置](../../assets/S11/C-skill/) |

### Prompt：三组保存的输入

**A：视觉草图**

```text
把中国地形图片做成立体地图效果，可以使用 CSS 透视和阴影。
```

**B：轻量 Three.js**

```text
使用 Three.js 和真实中国省级 GeoJSON 做一个 3D 地图。支持鼠标 hover；点击浙江省下钻到市级，并能返回全国。不得把 B20 光伏数据映射到省市。
```

**C：外部 Skill 模板**

```text
使用 $three-scope-map 的一对一模板和真实 GeoJSON 生成中国 3D 地图，保留 Earth 入口、挤出侧壁、边界、标签、hover、飞线、追光、浙江下钻、返回上级、GPL-3.0 SPDX 与原作者署名；构建后必须做桌面和手机浏览器、canvas 非空像素、WebGL、hover、下钻、控制台和资源体积验收。
```

原始文字也保存在 [`assets/S11/prompts/`](../../assets/S11/prompts/)；三组比较的是**同一任务由不同实现承担的结果**，不是三个隔离模型会话的成绩。

### 数据：真实边界从哪里来

本案例没有把现有业务数据硬塞到地图。全国和浙江边界由已审查的 Skill 数据解析器从明确 URL 下载，并在写入前验证层级、要素数量、坐标范围和行政代码。

| 数据 | URL | 要素 | 层级 | SHA-256 |
|---|---|---:|---|---|
| 中国 | `https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json` | 35 | 省级 | `99adfeded5223848bbe37a0a12f8023e11ee12161c7800521c27db42fdeac275` |
| 浙江 | `https://geo.datav.aliyun.com/areas_v3/bound/330000_full.json` | 11 | 市级 | `f87241d47687264861aa619b8dc37ffeb61a2be5d6018a8c01ec0ce0acb5cb38` |

全国数据与 GitHub Skill 模板自带 `china.json` 哈希完全一致。浙江使用本轮重新下载的当前公开数据，保存在 `assets/S11/data/`，不依赖浏览器临时联网。

### Skill 介绍与实际使用

是。C 组使用固定 commit 的真实源码副本，不是根据文字说明重新仿写。

| 字段 | 证据 |
|---|---|
| GitHub | `songsummer920-dazzle/three-scope-map-skill` |
| 固定 commit | `605867c0dc7f3a3b3ce601e76a695e4d9fe7a943` |
| 本地位置 | `skills/three-scope-map/` |
| 许可证 | GPL-3.0-or-later |
| 署名 | `作者全平台ID：宋夏天Dazzle；公众号：送你整个夏天` |
| 安全结论 | `CAUTION` |

我重新从 GitHub 下载该 commit 的 19,358,400 字节归档，将其中 `three-scope-map/` 与本地目录逐文件比较：59 个文件完全一致；`SKILL.md` SHA-256 为 `11593171e9de7decade8385fdff90d3c43ffad084f75c7b8567c50cc4f4c4193`。

随后真实运行了模板完整性校验、GeoJSON 解析器、严格项目检查、依赖安装、Vue 类型检查、Vite 生产构建和浏览器交互。`LICENSE`、`NOTICE`、`CITATION.cff`、SPDX 和原作者代码署名均保留在 C 组运行副本。

本机没有 `skillspector` CLI，因此 `CAUTION` 是源码语义审查结论。Skill 包含可联网的数据解析器、浏览器 `localStorage` 相机配置和较大的构建依赖，但未发现密钥读取、持久化、混淆或任意命令执行。本案例没有运行无关主题脚本，也没有写入密钥。

### A：看起来立体，不等于能操作

A 看起来有透视，但页面中没有 canvas，不能 hover、计算边界或下钻。它适合做反例：一张斜放的地图图片不能证明“Three.js 地图已经完成”。

![A 组 CSS 伪 3D](../../assets/S11/browser-check/A-css-fake-desktop.png)

### B：轻量 Three.js，能下钻但没有完整舞台

B 组用本地 Three.js 0.178.0 把 Polygon / MultiPolygon 转为 `ExtrudeGeometry`，实现：

- 全国 35 个省级要素；
- WebGL canvas，而不是 SVG 或图片；
- 鼠标射线 hover；
- 浙江 11 个市级要素离线下钻；
- 返回全国；
- 桌面和手机自适应。

![B 组手写 Three.js](../../assets/S11/browser-check/B-three-desktop.png)

浏览器实测记录到 hover“黑龙江省”，状态按 `35 → 11 → 35` 完成下钻和返回。canvas 像素 spread 为 37.17，非空；桌面和 390×844 手机均只有 1 个 WebGL canvas、无页面级横向溢出、0 console error。

[B 组手机画面](../../assets/S11/browser-check/B-three-mobile.png)可以与下方的 C 组手机截图一起看：能否操作和画面是否清楚，要分别核对。

它的限制也很明显：没有标签体系、飞线、追光、地形材质、南海插图和 Earth 入口，视觉层次远弱于 C。

### C：Skill 模板把哪些能力组合起来

C 从 Skill 自带的一对一模板开始，没有重新凭印象手写。严格检查确认存在：Earth 球体、China 曲面、挤出侧壁、行政边界、地形纹理、hover 抬升、标签、飞线、外轮廓追光、南海插图、层级栈、相机配置和资源释放。

![C 组 Earth 入口](../../assets/S11/browser-check/C-skill-earth-canvas-desktop.png)

真实浏览器操作顺序为：Earth 上 hover 中国 → 点击进入全国地图 → hover 浙江省 → 下钻至 11 个市 → 返回全国。桌面截图中的发光侧壁、标签和轮廓不是后期图片，而是通过 Chrome 运行的 WebGL canvas。

![C 组全国地图](../../assets/S11/browser-check/C-skill-desktop.png)

### 对照手机画面：C 也有代价

| 维度 | B 手写 | C Skill 模板 |
|---|---:|---:|
| 生产页面代码 | 10,334 B | 15 文件，共 9,964,445 B |
| 本地依赖目录 | 复用课程 Three.js | 111,223,489 B |
| 主 JS | 本地 ESM 两文件约 1.99 MB | 4,730 KB，gzip 1,623 KB |
| 功能 | hover、浙江下钻、返回 | Earth、材质、标签、飞线、追光、下钻、相机 |
| 桌面可读性 | 通过，较素 | 通过，表现力强 |
| 手机可读性 | 通过 | 自动检查无横向溢出，但人工视觉检查不通过 |

C 的 390×844 截图暴露了真实问题：顶部控制栏被压成竖排，全国 35 个标签相互拥挤。canvas 非空和 `scrollWidth == clientWidth` 并不能替代人工看图。

![C 组手机端拥挤问题](../../assets/S11/browser-check/C-skill-mobile.png)

安装时还发现 `nanoid@3.3.16` 的高危公告 `GHSA-2v37-7h3g-55p8`。它是 Vite → PostCSS 的间接开发依赖，本案例只在运行副本升级到 `nanoid@3.3.19`，再次审计为 0 vulnerability；原始 `skills/three-scope-map/` 固定版本没有改动。

### 结论与课堂选择

真正的 Skill 增益不只是“颜色更亮”，而是把 GeoJSON 层级、材质、交互、下钻、过渡、验证和署名绑成一套可复用流程。C 在桌面展示中明显领先 B；代价是包体、构建复杂度、GPL 义务和移动端适配工作。

如果目标只是一个轻量离线行政区选择器，B 更合适；如果要做高表现力的大屏入口，并且愿意承担筛选、适配和许可证要求，C 才值得采用。A 只能当视觉草图，不能算 Three.js 交付。

**课堂练习：**先对照 [B 的桌面结果](../../assets/S11/browser-check/B-three-desktop.png)与上面的 C 桌面、手机图，说出“能下钻”和“适合手机直接交付”分别需要什么证据。**参考思路：**B 与 C 都要实点浙江、返回全国；C 的 Earth 与材质增加表现力，但手机控制栏和标签拥挤，不能因为自动检查没有横向溢出就说手机可用。若任务只需离线选省市，应优先考虑 B。

### 不用 API Key，怎样展示

GeoJSON 下载是公开 URL，页面构建和浏览器渲染都在本机完成，不需要 OpenAI Key 或地图商业 API Key。数据已保存在仓库，后续离线展示只需本地静态服务器：

```bash
cd assets/S11
python3 -m http.server 5292 --bind 127.0.0.1
```

打开 `http://127.0.0.1:5292/`。完整运行回执见 [receipt.json](../../assets/S11/receipt.json)，浏览器回执见 [browser-verification.json](../../assets/S11/browser-check/browser-verification.json)。
