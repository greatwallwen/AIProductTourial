# Loop 执行报告（实操 37·问题定义）

> 数据来源：`outputs/11_loop_engineering/loop_report_sample.json`（3 行，异常 3）。字段与指标均回到该数据。演示原理 2.3、4.3，采用设计 emerald-flow。

## 产品问题

软件工程场景中，技术产品经理围绕AI 修复闭环做日常判断。技术产品经理需要围绕“AI 修复闭环”完成“把修复、检查和停止规则制度化”，并把结果转成可验证的产品交付物。核心不是把页面做出来，而是把指标、异常、责任和行动连成闭环。

## 岗位与业务对象

- 岗位：技术产品经理
- 业务对象：代码修复闭环
- 行业：软件工程

## 指标链（取自真实数据）

- Cycle覆盖率：21%
- builder处理时长：28
- checker异常数：35
- 失败项完成率：42%
- 回归复核通过率：49%

## 异常状态与责任

- [失败] 1 / fix-a / run-tests → 责任 fix-a
- [失败] 2 / fix-b / run-tests → 责任 fix-b
- [ALL GREEN] 3 / fix-c / run-tests → 责任 fix-c

## 决策动作

围绕AI 修复闭环判断优先级、责任人和验收动作。

## 风险边界

同一失败连续两轮必须停止

## 使用 Skill

loop-orchestrator、regression-guard、checker-report
