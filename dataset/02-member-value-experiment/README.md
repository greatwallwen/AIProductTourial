# 一张 ¥8 优惠券，先发给谁？

- 数据性质：`public-derived-with-sequence-proxy`
- 课程子集：`case.csv`，5,000 行
- 来源 ID：DATA-02
- 生成命令：`python transform.py`

## 这些数据能说明什么

- 源文件没有绝对事件时间和金额，不能声称完整 RFM 或真实客户终身价值。
- value_segment 是课程派生的行为参与度分层。
- ¥8 是实验方案中的可调券额，不是源数据里的历史消费金额。

原始下载、许可和固定版本见 `source.json`。
