# 目标用户与场景矩阵（实操 16·问题定义）

> 数据来源：`dataset/product_cases/hospital_ed_timely.csv`（4077 行，异常 1330）。字段与指标均回到该数据。演示原理 2.7、3.2，采用设计 graphite-hud。

## 产品问题

医疗运营 PM 要在有限急诊资源下缩短患者等待、减少「未就诊离开」。本案用真实公开数据——CMS《Timely and Effective Care - Hospital》（美国数千家医院急诊及时性指标，公共领域），4077 家医院的真实数据显示一个清晰规律：急诊量级越高，中位等待越长（极高量级约 199 分 vs 低量级约 124 分）、未就诊离开率也越高。增容/分流要按量级差异施策。

## 岗位与业务对象

- 岗位：医疗运营产品经理
- 业务对象：医院急诊及时性运营
- 行业：医疗运营

## 指标链（取自真实数据）

- 医院数：4077
- 中位急诊时长(分)：157.08
- 未就诊离开率均值：1.57%
- 急诊量级数：5
- 高负荷预警率：32.6%

## 异常状态与责任

- [流失偏高] SHANDS JACKSONVILLE / FL / 极高 → 责任 
- [候诊承压] BETHESDA HOSPITAL EAST / FL / 极高 → 责任 
- [等待过长] BAPTIST HOSPITAL OF MIAMI / FL / 极高 → 责任 
- [等待过长] LEE MEMORIAL HOSPITAL / FL / 极高 → 责任 
- [等待过长] HOLMES REGIONAL MEDICAL CENTER / FL / 极高 → 责任 
- [候诊承压] JACKSON HEALTH SYSTEM / FL / 极高 → 责任 

## 决策动作

判断各科室号源利用率与等待/爽约，形成放号、加号与分时预约的调度动作。

## 风险边界

不得自动改号/分诊或替代医生决策（高影响行业：保留人工复核，不得自动决策）

## 使用 Skill

persona-scenario、journey-map、human-review
