# 二十个综合案例

| 编号 | 案例 | 代码 |
|---|---|---|
| B01 | [取消单原单核对](B01-retail-return-evidence.md) | `code/cases/01-retail-return-evidence` |
| B02 | [会员优惠券试投](B02-member-value-experiment.md) | `code/cases/02-member-value-experiment` |
| B03 | [餐饮评论问题调查](B03-local-service-voc.md) | `code/cases/03-local-service-voc` |
| B04 | [信贷材料补正](B04-credit-human-review.md) | `code/cases/04-credit-human-review` |
| B05 | [医院转运事件调和](B05-hospital-flow-coordination.md) | `code/cases/05-hospital-flow-coordination` |
| B06 | [空气质量摘录质检](B06-beijing-air-quality-audit.md) | `code/cases/06-beijing-air-quality-audit` |
| B07 | [即时履约架构评审](B07-instant-retail-architecture.md) | `code/cases/07-instant-retail-architecture` |
| B08 | [养殖塘事件响应](B08-aquaculture-event-response.md) | `code/cases/08-aquaculture-event-response` |
| B09 | [地铁空压机检索辅助排查](B09-metro-agentic-rag.md) | `code/cases/09-metro-agentic-rag` |
| B10 | [通信请求恢复核查](B10-telecom-complaint-orchestration.md) | `code/cases/10-telecom-complaint-orchestration` |
| B11 | [企业模型准入补测](B11-model-release-multi-agent.md) | `code/cases/11-model-release-multi-agent` |
| B12 | [县域冷链运输调查](B12-vaccine-cold-chain.md) | `code/cases/12-vaccine-cold-chain` |
| B13 | [汽车售后安全分流](B13-auto-service-triage.md) | `code/cases/13-auto-service-triage` |
| B14 | [浮选高硅事件核查](B14-flotation-impurity-review.md) | `code/cases/14-flotation-impurity-review` |
| B15 | [半导体生产记录复测](B15-wafer-quality-review.md) | `code/cases/15-wafer-quality-review` |
| B16 | [风机出力下偏核查](B16-wind-underperformance.md) | `code/cases/16-wind-underperformance` |
| B17 | [包装切刀健康复核](B17-cutter-health-review.md) | `code/cases/17-cutter-health-review` |
| B18 | [锅炉主汽低温事件核查](B18-boiler-temperature-review.md) | `code/cases/18-boiler-temperature-review` |
| B19 | [液压系统维护排序](B19-hydraulic-condition.md) | `code/cases/19-hydraulic-condition` |
| B20 | [光伏站端损失归因](B20-pv-loss-attribution.md) | `code/cases/20-pv-loss-attribution` |

每个案例都按“需求—问题—数据—解决方案—Prompt—演示—实现与排错”组织。案例页面用于演示业务动作和状态变化，正文负责解释为什么这样设计。

## Skill 实验

| 编号 | 实验 | 可展示成果 |
|---|---|---|
| S05 | [没有 API Key，怎样做可展示的图像 Skill 测评？](S05-no-api-image-skill-evaluation.md) | A/B/C/D 完整 Prompt、字段覆盖与任务适配、本地可编辑构图样张 |
| S06 | [同一大纲的 PPTX 与 HTML Skill 竞技场](S06-ppt-html-skill-arena.md) | 可编辑 PPTX、14 KB 离线 HTML、Dashi 每页 3+1 方案与真实浏览器回执 |
| S10 | [Prompt、Skill 和 UI Kit 到底各自解决什么？](S10-prompt-skill-ui-kit.md) | 1,000 条 B10 数据、状态门、C/D 同合同页面和桌面/手机回执 |
| S11 | [看起来立体，和真正的 Three.js 地图差在哪里？](S11-real-geojson-three-map.md) | 真实 DataV GeoJSON、A/B/C 三组、Earth 入口、hover/下钻和移动端缺陷 |

S05 验证 Skill 怎样把固定简报编译成可检查的 Prompt；S06 验证同一 Markdown 在 PPTX 与两类 HTML Skill 中的交付差异；S10 拆开 Prompt、流程 Skill 与 UI Kit 的职责；S11 区分 CSS 伪 3D、手写 WebGL 和重型地图 Skill。所有实验都把未执行的模型调用与实际本地产物分开记录。

