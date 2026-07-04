# 案例 14 数据集设计：物流异常派单扩城

**文件**：`dataset/product_cases/aicourse_logistics_delivery.csv`（本地、确定性合成、可复现）
**Schema**：运单（运单号/线路/城市/计划时效h/实际时效h/异常类型/是否扩城/责任方）

## 设计的数据故事
700 运单；实际时效 vs 计划时效之差埋超时，异常类型分布于线路，是否扩城标注候选城市——支撑「按城市聚合时效 + 超时率排序 + 扩城决策」。

## 说明
所有 KPI/图表/异常均从上述真实列真算（见 metricSpec 与 build_case_data.buildChart），非模板占位；真实/合成显式标注于 dataset/MANIFEST.md。
