# CI 失败分诊报告（实操 48·方案验收）

> 数据来源：`code/server/tests + verify + routes（本仓库自身·dogfood）`（36 行，异常 8）。字段与指标均回到该数据。演示原理 2.3、2.5、4.3，采用设计 steel-queue。

## 交付物

CI 失败分诊报告

## 验收清单

- 必含字段：失败用例、失败类别、责任模块、首次出现
- 必含指标链：测试用例数、契约断言数、校验检查项、接口数
- 必含异常状态：断言失败、回归风险、待复现
- 必含 Skill：harness-builder、checker-report、regression-guard

## 合格标准

业务场景具体、指标链完整、异常状态可追踪、行动入口明确、验收条件可执行。

## 不合格标准

使用泛化产品名称、缺少行业指标、只描述页面不说明业务取舍、越过「分诊只做建议，合并/发布仍需人工确认，不自动 force-merge」。

## 验收结论

**PASS** — 指标链 4 项均为回到 `code/server/tests + verify + routes（本仓库自身·dogfood）` 的真实计算值；字段/异常/Skill 齐备；可运行原型见 `#/case/48`（设计 steel-queue），截图 `assets/screenshots/premium_case_48_ci_triage_loop_desktop.png`。
