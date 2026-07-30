# 高级 Agent 协议来源卡

核对日期：2026-07-29。

## MCP 生命周期与工具

来源：https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle

采用：客户端先发送 `initialize`，双方协商协议版本与能力；服务器响应后，客户端发送 `notifications/initialized`，随后才进入正常操作。stdio 关闭由客户端关闭输入并等待子进程结束。实验固定使用协议版本 `2025-11-25`，只开放 `tools` 能力。

来源：https://modelcontextprotocol.io/docs/learn/architecture

采用：host、client、server 分工；工具、资源和 Prompt 属于服务器能力，协议不替 Agent 决定何时使用结果。

## A2A 任务与发现

来源：https://a2a-protocol.org/latest/specification/

采用：A2A 用 Agent Card 描述能力，用 Message 交付输入，用 Task 表示有状态工作，用 Artifact 返回产物。实验只保留这一最小结构，不实现流式、推送通知、认证或网络部署，也不把同一进程内的普通函数调用冒充成跨 Agent 协作。

## 课程实现限制

本地 A2A 绑定用于展示数据结构和交接语义，不宣称通过跨网络互操作认证。MCP 是真实 stdio JSON-RPC 消息往返；A2A 是本地可重放的协议对象。实时模型只压缩确定性最终报告，不能替代窗口统计、来源覆盖检查和权限规则。
