# RAG 评测报告（命中率/错误分析）（实操 07·问题定义）

> 数据来源：`skills/external/pm-skills-deanpeters 语料 + 标注 Q/A（dogfood）`（12 行，异常 7）。字段与指标均回到该数据。演示原理 2.3、1.3，采用设计 cyan-matrix。

## 产品问题

你给产品接了个 RAG 问答，老板问「它到底答得准不准」，你只能说「我试了几个感觉还行」。把「感觉」变成「评测台」：定一组标注好的问题与期望命中，让系统离线跑一遍，算出命中率、列出没答对的，再决定上不上线。本案的语料就是本书已本地化的 deanpeters PM 语料（dogfood）。

## 岗位与业务对象

- 岗位：AI 产品经理 / 应用研发
- 业务对象：RAG 回答评测台
- 行业：AI 产品

## 指标链（真实数据）

- 评测问题数：12
- 命中率：41.7%
- 覆盖达标数：11
- 语料篇数：194

## 异常状态与责任

- [命中@3] how to prioritize requirements / commands/write-prd.md | prd-development/SKILL.md | commands/prioritize.md / 113 → 责任 产品-王（演示角色）
- [命中@3] RICE scoring model / prioritization-advisor/S | docs/Add-a-Skill Utility | research/Context Enginee / 32 → 责任 产品-王（演示角色）
- [命中@3] user interview techniques / discovery-interview-prep | commands/discover.md | product-sense-interview- / 65 → 责任 产品-王（演示角色）
- [命中@3] product roadmap planning / roadmap-planning/SKILL.m | commands/plan-roadmap.md | product-strategy-session / 87 → 责任 产品-王（演示角色）
- [未命中（覆盖足、检索未召回）] A/B experiment design / epic-hypothesis/template | opportunity-solution-tre | examples/sample.md / 54 → 责任 待标注
- [未命中（覆盖足、检索未召回）] north star metric / roadmap-planning/templat | examples/sample.md | recommendation-canvas/te / 70 → 责任 待标注

## 决策动作

用离线评测集量化「RAG 回答好不好」，据此决定能不能上线、还差哪些语料

## 风险边界

评测分数是发布参考，不替代人工抽检；分数高不等于零幻觉

## 使用 Skill

eval-design、harness-builder、acceptance-criteria
