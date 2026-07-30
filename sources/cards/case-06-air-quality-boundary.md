# 案例 06 来源卡：北京多站点空气质量

- 来源：UCI Machine Learning Repository，`Beijing Multi-Site Air Quality`，dataset id 501
- 固定入口：https://archive.ics.uci.edu/dataset/501/beijing+multi+site+air+quality+data
- 核验日期：2026-07-20
- 许可：CC BY 4.0
- 完整来源：420,768 条小时记录，12 个国家控制监测站，时间范围 2013-03-01 至 2017-02-28，缺失值用 NA 表示。
- 本地原始包：`dataset/06-beijing-air-quality-audit/raw/beijing-multi-site-air-quality.zip`
- 本地完整派生文件：`dataset/06-beijing-air-quality-audit/beijing-air-quality.parquet`
- 课程运行切片：`case.csv`，21,039 行；每个站点按源行号每 20 行抽取一行。

## 可用于课程的事实

- 来源规模、站点数、时间范围、字段单位和缺失值存在性。
- 当前切片中每个站点的记录数、污染物缺失分母、字段范围和行级证据。

## 不得外推

- 切片不是完整小时表；不同站点采用错开的源行偏移，没有任何时间点同时覆盖 12 站。
- 不得从切片构造“同一小时全市对比”，不得把描述统计写成污染成因、政策效果或健康建议。
