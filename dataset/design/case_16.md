# 案例 16 数据集设计：医院预约容量调度

**文件**：`dataset/product_cases/hospital_scheduling.csv`（本地、确定性合成、可复现）
**Schema**：门诊排期（就诊号/科室/预约时段/等待分钟/号源利用率/是否爽约/复核标记）

## 设计的数据故事
520 就诊；各科室号源利用率与等待分钟差异化，14% 爽约——支撑「按科室聚合均等待/利用率 + 爽约治理」。注：原文件误名 healthcare_diabetes，已更名 hospital_scheduling 与内容一致。

## 说明
所有 KPI/图表/异常均从上述真实列真算（见 metricSpec 与 build_case_data.buildChart），非模板占位；真实/合成显式标注于 dataset/MANIFEST.md。
