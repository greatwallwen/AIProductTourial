# RAG 评测报告（命中率/错误分析）（实操 49·方案验收）

> 数据来源：`skills/external/pm-skills-deanpeters 语料 + 标注 Q/A（dogfood）`（12 行，异常 9）。字段与指标均回到该数据。演示原理 2.6、1.3，采用设计 cyan-matrix。

## 交付物

RAG 评测报告（命中率/错误分析）

## 验收清单

- 必含字段：问题、期望命中、实际命中、是否通过
- 必含指标链：评测问题数、命中率、语料篇数、语料覆盖(万字)
- 必含异常状态：未命中、低相关、待标注
- 必含 Skill：eval-design、harness-builder、acceptance-criteria

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「评测分数是发布参考，不替代人工抽检；分数高不等于零幻觉」。

## 验收结论

**PASS** — 指标链 4 项均为回到 `skills/external/pm-skills-deanpeters 语料 + 标注 Q/A（dogfood）` 的实际计算值（真实数据）；字段/异常/Skill 齐备；可运行原型见 `#/case/49`（设计 cyan-matrix），截图 `assets/screenshots/premium_case_49_rag_eval_harness_desktop.png`。
