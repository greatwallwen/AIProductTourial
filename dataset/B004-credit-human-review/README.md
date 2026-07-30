# 申请材料人工复核

- 主数据：`applications.csv`，1,200 条匿名申请、19 个字段。
- 数据性质：`deterministic-synthetic-operational`。
- 金额单位：人民币分；界面固定换算为人民币元。
- 地域与渠道：使用中国省市编码和本地业务渠道，不含姓名、证件号、电话或地址。
- 固定检查：见 `expected.json`。

## 使用范围

`applications.csv` 只支持材料核对、规则版本控制、人工复核、申诉与群体审计演示。任何信号都不能直接生成授信、拒贷或个体公平性结论。

`case.csv`、`eval.jsonl` 与 `raw/default-credit-clients.zip` 是 UCI 台湾地区历史研究样本及其课程派生物，只用于离线讲解方法与偏差，不进入当前个体页面，也不代表中国经营事实。
