# 实验 01 · 证据优先与有界 Loop

这一个实验覆盖活动 01-04。目标不是“看懂 Loop”，而是留下两份能重放的
轨迹：一次收敛、一次按规则停机。

## 基线

```bash
node code/tools/verify_course_package.mjs
node code/labs/loop/run.mjs --scenario converge
node code/labs/loop/run.mjs --scenario repeated-failure
```

## 交付

1. 从 verify 输出中写出目标、传感器、失败定位和停止条件。
2. 给旧式“关键词存在即通过”的检查器构造一个投机提交，再证明结构化检查会拦住它。
3. 对比两条 Loop trace 的 `stopReason`、`failureFingerprint` 和 `cycles`。
4. 把停机后的失败项、已尝试动作和升级对象写入 `escalationPacket`。

验收以 `course/activities.json` 和 `rubric-evidence-loop`、
`rubric-bounded-loop` 为准，不以文字篇幅为准。
