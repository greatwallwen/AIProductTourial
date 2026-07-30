# 北京空气质量数据口径与证据审计台

- 数据性质：`public-derived`
- 课程子集：`case.csv`，21,039 行
- 来源 ID：DATA-06
- 生成命令：`python transform.py`

## 这些数据能说明什么

- 缺失不是 0，相关性不是污染成因。
- case.csv 是固定抽样；完整派生数据保存在 Parquet。

原始下载、许可和固定版本见 `source.json`。
