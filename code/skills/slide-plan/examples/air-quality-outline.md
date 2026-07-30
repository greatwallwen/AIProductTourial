# 让数据先过体检

> 从可读的 Markdown 到可编辑、可审计的演示文稿

<!-- notes: 开场说明本文稿的目标是建立数据质量共识，不对污染原因下结论。 -->
<!-- source: Course-local S002 profile output. -->

## 01 为什么先体检

<!-- layout: section -->
<!-- notes: 转入方法部分：先确认数据边界，再决定能回答什么。 -->
<!-- source: Course-local course method. -->

## 缺失不是零

- 记录文件、编码、行列数与时间范围
- 分字段统计缺失，不自动删除或填补
- 把观察事实与处置建议分开

<!-- notes: 强调缺失值会改变后续指标分母，但本页不预设填补方案。 -->
<!-- source: Course-local data-profile contract. -->

## 三项代表污染物缺失需单列

| 字段 | 缺失数 | 缺失率 |
|---|---:|---:|
| PM2.5 | 466 | 2.21% |
| CO | 1,027 | 4.88% |
| O3 | 830 | 3.95% |

<!-- notes: 表格只展示三个代表字段；完整六项数值保留在 profile.json。 -->
<!-- source: dataset/B006-beijing-air-quality-audit/case.csv; S002 profile generated locally. -->

## 把数据问题交给可复查的流程

<!-- graphic: quality-review-flow | 待绘制“读取→体检→人工复核→分析”四步流程，保留一个停止分支。 -->
<!-- notes: 图形仍是占位合同，不应在没有绘制和检查时写成已完成。 -->
<!-- source: Course-local workflow contract. -->
