# Prompt 与 Skill 工程来源卡

核对日期：2026-07-28。

## 采用的合同

### Agent Skills 规范

来源：https://agentskills.io/specification

课程采用以下硬约束：一个 Skill 是一个目录，至少包含 `SKILL.md`；前置元数据必须有 `name` 和 `description`；脚本、参考资料和静态资源分别放入 `scripts/`、`references/`、`assets/`；长资料按需读取，不塞进主文件。课程会验证名称、目录一致性、触发语句和不触发语句。

### OpenAI 当前插件与模型文档

来源：

- https://github.com/openai/plugins
- https://github.com/openai/role-specific-plugins
- https://developers.openai.com/api/docs/guides/latest-model

`openai/plugins` 说明插件是分发单元，可以组合 manifest、Skill、MCP、应用界面和其他资源。课程据此区分三件事：只需复用规程时写 Skill；需要外部系统能力时接 MCP；需要安装、分发和治理一组能力时再做 Plugin。Prompt 部分采用“目标、上下文、约束、成功标准、输出格式、代表性测试”的瘦契约，不重复堆角色设定。

### 开源 Skill 仓库

来源：

- https://github.com/anthropics/skills
- https://github.com/obra/superpowers
- https://github.com/mattpocock/skills
- https://github.com/huggingface/skills
- https://github.com/NVIDIA/skills

这些仓库只用于比较写法：Anthropic 提供通用 Skill 样例；Superpowers 展示组合工作流、测试先行和完成前验证；Matt Pocock 展示工程任务的紧凑规程；Hugging Face 与 NVIDIA 展示带外部工具和领域依赖的 Skill。课程不会按 Star 数量推荐，也不会复制未知脚本直接运行。

## AIProductTourial 的取舍

来源：https://github.com/greatwallwen/AIProductTourial

保留：问题定义、指标、验收、架构评审、测试、复盘、证据包等题目，以及“真实数据—可运行界面—截图—自检”的组织方法。

改写：把 `pm_skills.md` 的单体卡片拆成规范化 Skill 目录；把六格说明改成真实输入、脚本、结构化产出和测试；把 Vite 示例映射到本课程的 Next.js 统一运行内核。

不采用：把题目清单当成已运行 Skill、把生成文本当成验证结果、把同一种 UI 套到所有业务现场。

## 两份本地教程的取舍

Prompt 参考保留中文业务题目、少样本、格式约束和逐轮改写；淘汰重复角色扮演、同义模板、大段无验收输出和绝对磁盘路径。

数据分析参考保留超市订单、农产品价格、会员与评论等数据故事；淘汰过时依赖、逐行工具教学、无法追溯来源的数据结论和把相关性写成原因的表述。

## 数据边界

`dataset-anlalyse` 是用户提供的候选材料，不是统一许可的数据发布包。中国超市订单和农产品价格在课程中标为“用户提供的教学数据”；在原始网址和再分发许可核实前，不宣称公开可再分发。安全案例使用课程生成的确定性样本，明确写明不是真实攻击或企业运行记录。
