# 案例 28 数据集设计：金融复核工作台

**文件**：`dataset/reference_data_analysis/28-creditcardfraud_sample.csv`（本地、确定性合成、可复现）
**Schema**：交易（交易号/金额/渠道/小时/风险信号/风险等级/复核/命中规则数）

## 设计的数据故事
600 交易；~8% 欺诈标高风险，跨境渠道金额最大风险最高，命中规则数随风险升——支撑「按渠道聚合金额 + 风险×金额排序复核」。高影响：保留人工复核。

## 说明
所有 KPI/图表/异常均从上述真实列真算（见 metricSpec 与 build_case_data.buildChart），非模板占位；真实/合成显式标注于 dataset/MANIFEST.md。
