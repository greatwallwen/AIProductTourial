# 循环编排器 · 有界状态机模板

以循环方式执行任务：
0. 对齐目标：写一行任务简报（目标/涉及文件/完成标准/预算/人工关口），生成本轮 run id。
1. 派 builder 实现（或修复上一轮失败）。
2. 派 checker 运行所有检查，保存完整输出、耗时、证据引用和失败指纹。
3. evaluator 只做四选一：`complete`、`continue`、`pause-for-approval`、`escalate`。
4. `complete`：停止，展示 diff、检查结果和 trace hash。
5. `continue`：把**完整失败报告原样转发** builder，不丢行号、堆栈和中间输出。
6. `pause-for-approval`：序列化当前状态，等待人的决定后从同一个 run id 恢复。
7. `escalate`：按 `stop-rules.md` 生成升级包，不再调用 builder。

轮次最多 5 轮，每轮声明 `Cycle N/5`。最大轮次、重复失败、回归、预算和外部边界任何一个先触发都必须停。每轮最小 trace 字段：`runId/cycle/goal/action/checkerResult/failureFingerprint/durationMs/evidenceRefs/decision`。
