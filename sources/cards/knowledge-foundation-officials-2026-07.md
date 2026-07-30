# 统一知识底座官方来源卡

核对日期：2026-07-29。

## Harness

- OpenAI《Harness engineering: leveraging Codex in an agent-first world》：https://openai.com/index/harness-engineering/
- 正文只吸收可迁移的方法：项目内知识作为真值、渐进读取、让页面与日志可观察、用结构检查保护架构、隔离任务环境、把人工反馈固化成规则。
- 不采用“代码全部由 Agent 生成”等组织实验作为一般课程结论，也不把 Harness 解释成一个特定产品或库。

## MCP

- 官方架构：https://modelcontextprotocol.io/docs/learn/architecture
- 2026-07-28 规范候选说明：https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- 稳定教学内容是 host、client、server，能力协商，以及 tools、resources、prompts。Tasks 与扩展仍随规范演进，正文只在高级实验中标明版本，不把候选特性写成永久事实。

## A2A

- 官方规范：https://github.com/a2aproject/A2A/blob/main/docs/specification.md
- 核对时规范标注最新发布版本为 1.0.0。课程采用 Agent Card、Message、Task、Artifact、任务状态和 HTTP/JSON 交接，不讲各 SDK 的临时封装。
- A2A 用于独立、内部实现彼此不可见的 Agent 系统；同一应用内的函数调用不属于 A2A。

## DDD 与事件驱动

- Microsoft Learn，领域分析与微服务边界：https://learn.microsoft.com/azure/architecture/microservices/model/domain-analysis
- Microsoft Learn，领域事件设计：https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation
- Azure Architecture Center，事件驱动架构：https://learn.microsoft.com/azure/architecture/guide/architecture-styles/event-driven
- 课程采用通用语言、限界上下文、实体、值对象、聚合、领域事件和防腐层；微服务只是边界可能采用的部署方式，不与 DDD 画等号。

## 采用边界

正文用自然语言解释判断方法，不放来源列表。版本、发布日期和协议细节保留在本来源卡；课堂当天若要演示在线协议，应先重新核对官方版本。
