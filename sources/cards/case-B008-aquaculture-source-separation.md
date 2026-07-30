# 案例 08 来源卡：公开空间资产与中国课程事件

核验日期：2026-07-23。

## DATA-08A：中国养殖塘空间资产

- 来源：https://data.mendeley.com/datasets/nbnx734fmv/1
- DOI：`10.17632/nbnx734fmv.1`
- 许可：CC BY 4.0
- 本地索引：`geo-assets.csv`，38 个 GeoTIFF 成员、9 个区域标识
- 使用方式：提供区域与归档成员的公开空间索引，不提供水质、疾病、产量或处置结果

## COURSE-OPS-08：中国养殖运营课程序列

- 本地文件：`case.csv`
- 规模：864 行、15 列；96 小时 × 9 个区域
- 生成方式：由 `transform.py` 确定性生成
- 关联键：每条事件用 `region_id + archive_member` 指向 DATA-08A 的一项资产，未关联事件为 0
- 数据性质：`deterministic-synthetic-cn-operations`

## COURSE-OPS-08 修复记录

- 本地文件：`repair-evidence.jsonl`
- 规模：38 条
- 校验项：事件编号、空间资产、原事件指纹、修复版本和数据性质

课程事件和修复记录都不是实际养殖场观测。它们只用于复算状态机、角色权限与操作记录。案例禁止自动投药、自动增氧、鱼病诊断、因果归因和设备控制。
