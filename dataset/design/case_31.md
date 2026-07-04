# 案例 31 数据集设计：广告投放转化复盘

**文件**：`dataset/reference_data_analysis/18-ad_performance.csv`（本地、确定性合成、可复现）
**Schema**：投放（活动/渠道/曝光/点击/转化/花费/CPA/CTR/CVR）

## 设计的数据故事
渠道×活动 30 行；埋数据故事——搜索/会员日 CVR 高（优质），信息流A 点击高但 CVR 低（落地页问题）——支撑「按渠道聚合漏斗 + 找断点 + 预算重分配」。

## 说明
所有 KPI/图表/异常均从上述真实列真算（见 metricSpec 与 build_case_data.buildChart），非模板占位；真实/合成显式标注于 dataset/MANIFEST.md。
