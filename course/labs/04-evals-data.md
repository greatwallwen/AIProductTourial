# 实验 04 · 评测与数据决策

活动 09 使用真实的 `VectorStore.search()`，活动 10 使用发布版合成数据夹具。
二者都要求“结果能改变决策”，不是只截图一个漂亮数字。

```bash
node code/tools/eval_harness.mjs --json
node code/labs/data/query.mjs --fixture defi-risk
```

RAG 交付必须列出基线、修改、修改后结果与回归项。数据决策交付必须列出
查询标识、结果哈希、异常、负责人、复核时间和外推限制。

本地 `dataset/` 下的大文件不进入 Git。EPC 和交易图数据只有在许可与隐私
复核通过、且生成去标识聚合夹具后，才可升级为公开课程活动。
