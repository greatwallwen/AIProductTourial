# 实验 03 · MCP 能力协商与越权探针

这里使用一个最小 stdio MCP 教学服务器。它只实现课程需要的协议面，不假装
是生产 SDK 替代品。

```bash
node code/labs/mcp/client.mjs
node code/labs/mcp/client.mjs --probe-denied
```

第一条命令必须按顺序留下 `initialize`、`notifications/initialized`、
`tools/list`、`resources/list`、`prompts/list` 和一次 `tools/call` 轨迹。
第二条命令尝试调用未协商的工具，预期得到结构化拒绝。

交付的威胁模型至少覆盖：本地进程边界、远程授权、用户批准、敏感参数、
Origin 校验和日志脱敏。工具、资源、提示词要分别说明为什么放在该原语下。
