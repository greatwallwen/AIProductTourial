## 5. 设计系统（多套，各不相同）

![多套设计系统](outputs/product_case_library/svg/fig_designs.svg)

> 不是一套统一审美：`design/` 下 ≥5 套**各不相同**的深色大屏设计系统（色板/布局/气质各异，对齐大屏参考与 voltagent DESIGN.md 模型）。不同案例采用不同设计 → 大屏风格各异。机器令牌单一来源 `design/themes.json`，人读文档 `design/<id>.md`。

### 5.1 石墨 HUD
#### 5.1.1 青蓝高光
#### 5.1.2 上图下表
#### 5.1.3 经营驾驶舱

```备注
为什么同样是「深色大屏」，有的看着高级、有的像套了模板的 PPT？差别就在设计系统。石墨 HUD 这套：石墨黑打底、青蓝(#22d3ee)做高光、铺一层 HUD 网格线，布局走「顶部总览 → 中部趋势主图 → 底部明细表」的经典驾驶舱结构——信息密度拉满但不乱。它适合 executive_dashboard、hr 这类要一眼看全局的经营驾驶舱（本教程电商早会、零售方案就用它）。完整色板/字号/圆角令牌见 design/graphite-hud.md。
```

### 5.2 翡翠流向
#### 5.2.1 翡翠发光
#### 5.2.2 桑基瀑布
#### 5.2.3 流程流向

```备注
近黑墨绿、翡翠(#10b981)发光、流向感；桑基/瀑布纵向布局。适用 workflow_pipeline/knowledge 类流程流向。见 design/emerald-flow.md。
```

### 5.3 琥珀漏斗
#### 5.3.1 暖金高光
#### 5.3.2 漏斗级联
#### 5.3.3 转化收束

```备注
深棕琥珀、暖金(#f59e0b)高光、转化收束；漏斗级联布局。适用 sales_funnel 类转化分析。见 design/amber-funnel.md。
```

### 5.4 青紫矩阵
#### 5.4.1 双色高光
#### 5.4.2 矩阵热力
#### 5.4.3 密集决策

```备注
墨蓝、青(#06b6d4)与品紫(#a855f7)双高光、密集矩阵；矩阵/热力/散点布局。适用 matrix_decision/finance/harness/configuration。见 design/cyan-matrix.md。
```

### 5.5 钢灰队列
#### 5.5.1 冷蓝高光
#### 5.5.2 复核队列
#### 5.5.3 明细留痕

```备注
钢灰近黑、冷蓝(#60a5fa)高光、明细与复核；复核队列/明细表布局。适用 review_queue/list_review/record_detail。见 design/steel-queue.md。
```
