# RAG 检索方案与验收（实操 04·方案验收）

> 数据来源：`skills/external/pm-skills-deanpeters`（194 行，异常 0）。字段与指标均回到该数据。演示原理 1.3、3.3，采用设计 emerald-flow。

## 交付物

RAG 检索方案与验收

## 验收清单

- 必含字段：查询、命中文档、相似度、片段
- 必含指标链：语料篇数、语料总字(万)、平均篇幅(字)、覆盖主题数
- 必含异常状态：低相似、无命中、越权语料
- 必含 Skill：capstone-product-flow、evidence-pack、traceability-check

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「不得把低相似片段当作事实回答」。

## 验收结论

**决策动作**：用真实向量检索为问答/推荐提供高相关片段，替代全量塞入

**PASS** — 指标链 4 项均为回到 `skills/external/pm-skills-deanpeters` 的实际计算值（真实数据）；字段/异常/Skill 齐备；可运行原型见 `#/case/04`（设计 emerald-flow），截图 `assets/screenshots/premium_case_04_rag_knowledge_retrieval_desktop.png`。
