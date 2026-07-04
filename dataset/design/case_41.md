# 案例 41 数据集设计：零售经营产品方案

**文件**：`dataset/order_data.csv`（本地、确定性合成、可复现）
**Schema**：复用案例01 电商订单（综合闭环视角）

## 设计的数据故事
同 order_data.csv，但从「端到端经营方案」视角：营收/毛利/动销/责任闭环，把早会异常→洞察→动作→验收串成一份可交付方案。

## 说明
所有 KPI/图表/异常均从上述真实列真算（见 metricSpec 与 build_case_data.buildChart），非模板占位；真实/合成显式标注于 dataset/MANIFEST.md。
