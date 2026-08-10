# B20 光伏站端记录核查台 · C4 四层架构图运行案例

> 按 `skill-map.md` → 05 产品与系统架构 → drawio-skill 执行。
> 运行时间：2026-08-06

## 环境与适配

| 依赖 | 状态 | 处置 |
|---|---|---|
| draw.io desktop CLI | **已安装 v31.1.5**（`C:\Program Files\draw.io\draw.io.exe`） | 用原生 CLI 导出 SVG |
| Python 3 / Graphviz | 未安装 | c4.py 的 Graphviz 自动布局改为手动坐标布局（按关系走向设计，避免边交叉） |
| Node.js v24.14.0 | 可用 | 用 Node.js 移植 c4.py 逻辑生成 `.drawio`（`tmp/gen-b20-c4.mjs`） |

> 两步管线：① Node.js 脚本按 C4 规格生成 `.drawio` 源文件（手动坐标布局，按关系走向设计避免边交叉）；② draw.io desktop CLI 原生渲染导出 SVG。

## 输入

- 案例：`AI时代研发产品项目一体化知识库/案例/B20-pv-loss-attribution.md`
- 代码：`code/cases/20-pv-loss-attribution/`、`code/app/src/components/workbenches/case-specific/PvLossWorkbench.tsx`
- C4 规格：`tmp/B20-c4-spec.json`（4 层 × 元素 × 关系）

## 输出（结果文件）

| 文件 | 说明 |
|---|---|
| `assets/case-diagrams/B20-c4.drawio` | 4 页 drawio 源文件，可用 draw.io desktop / diagrams.net 打开编辑 |
| `assets/case-diagrams/B20-c4-layer-L1.svg` | L1 系统上下文：性能工程师 / 运维主管 / 核查台 / 公开数据集 / 调度系统 |
| `assets/case-diagrams/B20-c4-layer-L2.svg` | L2 容器：Next.js 工作台 / 类型化命令服务 / 事件记录 / 站日事实存储 |
| `assets/case-diagrams/B20-c4-layer-L3.svg` | L3 组件：事实/线索/缺失/任务/趋势/站点选择六面板 |
| `assets/case-diagrams/B20-c4-layer-L4.svg` | L4 代码：PvLossWorkbench / restoreTask / runCommand / trendSegments / domain-command |

## 过程性文件（tmp）

| 文件 | 作用 |
|---|---|
| `tmp/B20-c4-spec.json` | C4 四层 JSON 规格，元素与关系定义 |
| `tmp/gen-b20-c4.mjs` | Node.js 生成脚本，手动坐标布局 + drawio/SVG 双输出 |

## 四层要点

### L1 系统上下文
- **性能工程师**：查看站日事实与派生线索，提交站端核查任务
- **运维主管**：确认核查方向，登记禁止控制变更
- **光伏站端记录核查台**：分栏展示事实/线索/缺失/任务，不自动改变控制
- **公开站日数据集**：5,327 站日 · 8 匿名站点 · CSV（外部）
- **调度/告警/检修系统**：数据集未包含，需申请补取（外部，未接入）

### L2 容器
- **Next.js 工作台**（React/TS）：四栏 SPA
- **类型化命令服务**（Node.js）：申请·提交·确认·登记
- **事件记录**（SQLite）：状态持久化与版本追溯
- **站日事实存储**（CSV）：case.csv + stations.csv

### L3 组件（工作台内部）
站日事实面板 → 派生线索面板 → 缺失记录面板 → 人工核查任务面板，辅以日级历史趋势与站点选择栏。

### L4 代码
`PvLossWorkbench.tsx` 主组件通过 `restoreTask()` 还原状态、`runCommand()` 分发三命令、`trendSegments()` 渲染缺测断线趋势，类型约束来自 `domain-command.ts`。

## 复现命令

```powershell
# 1. 生成 .drawio 源文件（Node.js）
node tmp/gen-b20-c4.mjs

# 2. draw.io CLI 原生导出 4 页 SVG
$drawio="C:\Program Files\draw.io\draw.io.exe"
$base="d:\文档\GitHub\AIProductTourial\assets\case-diagrams"
foreach ($i in 1..4) {
  & $drawio -x -f svg -p $i --size diagram -b 20 -u `
    -o "$base\B20-c4-layer-L$i.svg" "$base\B20-c4.drawio"
}
```

## 备注

- SVG 由 draw.io desktop v31.1.5 原生导出（`-u` 未压缩、`--size diagram` 裁剪到内容、`-b 20` 留 20px 边距），含完整样式与字体嵌入，浏览器可直接查看。
- `.drawio` 源文件可在 draw.io desktop / diagrams.net 中打开编辑，调整布局后可重新导出。
- 手动坐标布局按关系走向设计（L1 中心辐射、L2 线性+分支、L3 蛇形、L4 树形），确保边不交叉；如需更精细排版可在 draw.io 中拖拽调整后重新导出。
