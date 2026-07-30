# 课程基础理论来源卡

核对日期：2026-07-29。

这张卡只记录正文需要的概念和采用边界。课程不复述论文摘要，也不把某一厂商的产品能力写成普遍规律。

## 模型与 Prompt

- Transformer 原始论文：<https://arxiv.org/abs/1706.03762>。课程只采用注意力机制能够在序列中建立上下文联系这一基础；不据此声称模型“理解”了业务事实。
- Few-shot 原始论文：<https://proceedings.neurips.cc/paper/2020/hash/1457c0d6bfcb4967418bfb8ac142f64a-Abstract.html>。课程用少量正例、反例帮助模型识别任务形式，但每个业务结论仍需由输入材料支持。
- NIST AI 600-1：<https://doi.org/10.6028/NIST.AI.600-1>。课程把生成式 AI 风险放进设计、开发、使用和评价全过程，不把一句免责声明当作治理。
- OWASP LLM01:2025 Prompt Injection：<https://genai.owasp.org/llm-top-10/>。课程把外部文档、网页和评论视为数据；其中夹带的指令不得改变系统权限或调用未授权工具。

## Agent、Skill 与 Loop

- ReAct 原始论文：<https://arxiv.org/abs/2210.03629>。课程采用“观察—决定—行动—再观察”的交替结构，让外部工具补充模型没有的事实。
- Anthropic《Building effective agents》：<https://www.anthropic.com/engineering/building-effective-agents>。课程区分预先编排的 workflow 与由模型动态决定步骤的 agent；能用单次调用或固定流程完成时，不增加自治层。
- Agent Skills 规范与参考实现：<https://github.com/agentskills/agentskills>。Skill 至少包含 `SKILL.md`，可按需带 `scripts/`、`references/`、`assets/`；发现、激活、执行分阶段加载。
- Self-Refine 原始论文：<https://arxiv.org/abs/2303.17651>。课程采用“生成—按清楚标准检查—只修未通过项”的结构；没有判定标准时，不用无限反思制造更多文字。
- Anthropic Agent Evals：<https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents>。课程把最终环境状态作为主要结果。例如 Agent 说“已退款”不算完成，数据库中存在对应退款记录才算；运行轨迹用于解释，不替代结果。

## 数据、检索与互操作

- RAG 原始论文：<https://papers.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html>。课程采用参数化模型与外部检索资料组合的思想；检索命中不等于结论正确，仍要保留出处与适用范围。
- MCP 官方架构：<https://modelcontextprotocol.io/docs/learn/architecture>。课程只讲稳定的 host—client—server 分工，以及 tools、resources、prompts 三类基本能力；版本和传输细节以课堂当天官方文档为准。
- A2A 官方规范：<https://github.com/a2aproject/A2A/blob/main/docs/specification.md>。课程把 A2A 用于独立 Agent 之间的发现、任务协作和状态交换，不用它替代同一应用内的普通函数调用。

## 本地参考的采用方式

- `AIGC实操-Prompt工程.md`：保留“任务说明、参照、思辨、逐轮反馈、让模型先提问、控制上下文、少样本”这些教学动作；删除重复角色模板、同义句堆叠和无材料支撑的行业结论。
- `AIGC实操 -数据分析.md`：保留中国业务数据和“先理解字段，再计算，再解释”的顺序；不复制过时依赖、逐行代码课和把相关性写成原因的结论。
- `AIGC-agent.pdf`：保留“从会提问到会设计工作流”的递进，以及电商分析、视觉、PPT、小游戏、3D 等可见作品；重新补齐 Skill 合同、工具权限、检查条件和停止条件。
- `深度有趣.pdf`：采用“一个问题、一组材料、一个可见结果”的项目节奏。趣味来自对象和结果，不来自夸张标题或段子。
- `greatwallwen/AIProductTourial` 固定快照：保留问题定义、指标、验收、架构评审、Skill 治理和真实案例组织；正文重新写作，不复制原段落。

## 写作约束

1. 基础理论只解释下一次实践会用到的一个判断。
2. 每个实验保留完整输入、完整 Prompt、观察点和一项可见结果；不粘贴长篇随机回答。
3. “模型说完成”与“文件、页面或业务状态已经改变”分开表述。
4. 来源只放在来源卡和来源账本，正文用自然语言讲课。
