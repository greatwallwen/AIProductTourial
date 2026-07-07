# CI 失败分诊报告（实操 48·问题定义）

> 数据来源：`code/server/tests + verify + routes（本仓库自身·dogfood）`（22 行，异常 8）。字段与指标均回到该数据。演示原理 2.3、2.5、4.3，采用设计 steel-queue。

## 产品问题

你们的 CI 一红，群里就开始「是不是我这块」的猜谜，半小时过去还没定位。把这件事做成一个分诊 Loop：每次失败自动按「哪个测试、哪类断言、哪个模块」归类，给出责任建议与重试入口——人只需确认，不再猜谜。本案的数据就是本仓库自己的测试套件、校验器与接口契约（dogfood）。

## 岗位与业务对象

- 岗位：研发 Tech Lead / 交付负责人
- 业务对象：CI 失败分诊台
- 行业：研发效能

## 指标链（取自真实数据）

- 契约断言数：22
- 接口契约数：16
- 校验检查项：193
- 后端模块数：9

## 异常状态与责任

- [断言失败] /api/health / 契约 / routes/api.ts→services → 责任 研发-王
- [回归风险] /api/arch / 数据 / routes/api.ts→services → 责任 测试-赵
- [待复现] /api/cases / 边界 / routes/api.ts→services → 责任 研发-李
- [断言失败] /api/index / 契约 / routes/api.ts→services → 责任 研发-王
- [回归风险] /api/case/:num/data / 数据 / routes/api.ts→services → 责任 测试-赵
- [待复现] /api/points3d / 边界 / routes/api.ts→services → 责任 研发-李

## 决策动作

把一次 CI 失败自动分诊到「哪个模块、哪类问题、谁来修」，人只做确认

## 风险边界

分诊只做建议，合并/发布仍需人工确认，不自动 force-merge

## 使用 Skill

harness-builder、checker-report、regression-guard
