# 数据集清单（真实公开数据，本地留存）

本目录存放各案例工程的**真实数据来源**。原始大文件不入库（见 `.gitignore` 忽略的 `_raw/`），由 `node scripts/fetch-datasets.mjs` 重新下载；各案例实际读取的是下方 committed 小文件。工程测试与种子**一律离线**读取这些文件，网络只在运行 `fetch-datasets.mjs` 时使用。

取回日期：2026-07-03。

## 案例三 · 设备监控 — UCI 液压系统状态监测

- **来源**：UCI Machine Learning Repository, dataset 447 *Condition Monitoring of Hydraulic Systems*
  <https://archive.ics.uci.edu/dataset/447/condition+monitoring+of+hydraulic+systems>
- **采集方**：ZeMA gGmbH / Universität des Saarlandes（Nikolai Helwig, Tizian Schneider, Andreas Schütze）
- **许可**：Creative Commons Attribution 4.0 International（CC BY 4.0）
- **引用**：N. Helwig, E. Pignanelli, A. Schütze, *Condition Monitoring of a Complex Hydraulic System Using Multivariate Statistics*, IEEE I2MTC-2015. doi:10.1109/I2MTC.2015.7151267
- **原始规模**：2205 个 60 秒恒载工作周期；17 路传感器（压力/电机功率/流量/温度/振动/冷却效率等），采样率 1/10/100 Hz。四类部件（冷却器/换向阀/泵/蓄能器）的退化状态逐周期标注于 `profile.txt`。
- **committed 文件**：`03-device-monitor/hydraulic-window.csv`（576 行）
  `sha256 94a1b25502f0b604da6294a05a64ec840b12afd4d7ed0957970c77a550971dad`
- **重整规则**（`build03`）：对所选周期，逐路取该周期内全部采样点的**算术均值**（PS2/TS1/TS3/VS1/CE/CP/FS1）。取 456 个冷却器满效（100%）且油温/冷却效率正常的周期作健康段，接 120 个冷却器近失效（3%）且明确越限的周期作故障段，共 576 个真实周期按此顺序排列，构成"健康约 38 小时 → 冷却器失效、油温升高、冷却效率跌落（最近约 10 小时）"的退化时间线。**数值未做任何修改**，仅按 `profile.txt` 的冷却器状态选取与排序。
- **字段映射（→ 工程遥测）**：`PS2_bar→系统压力(bar)`、`TS1_C→油液温度(℃)`、`TS3_C→冷却器出口温度(℃)`、`VS1_mms→泵振动速度(mm/s)`、`CE_pct→冷却效率(%)`、`CP_kW→冷却功率(kW)`、`FS1_lmin→主回路流量(l/min)`；`cooler/valve/pump/accum` 为逐周期真实故障标签，用于对照告警。

## 案例四 · SaaS 工单 — GitHub Issues（每个公开仓 = 一个租户）

- **来源**：GitHub REST API `GET /repos/{owner}/{repo}/issues?state=all`（排除 pull request）
- **仓库→租户**：`supabase/supabase`（Supabase Inc.）、`prisma/prisma`（Prisma Data, Inc.）、`vercel/next.js`（Vercel Inc.）
- **许可/使用**：各仓 issue 标题与状态为公开数据；仅留存最小字段用于教学演示，出处如上。
- **committed 文件**：`04-saas-ticket/issues.json`（48 条真实 issue）
  `sha256 ba9b88f102890795bde70d4ab6e5acd89a54ef323708e4a9176af19ff072affd`
- **字段映射（→ 工单）**：`title→工单标题`、`state(open/closed)→状态`、`labels→分类/优先级`、`created_at/closed_at→创建与解决时刻（SLA 时序）`、`number→原始编号`。租户封装（`tenant_code`/`plan`/API Key）为应用内部信息，保持合成。

## 案例一 · 政务审批 — GB/T 2260 全国行政区划

- **来源**：modood/Administrative-divisions-of-China（依据国家标准 GB/T 2260 与民政部公开区划代码）
  <https://github.com/modood/Administrative-divisions-of-China>
- **许可**：MIT（代码）；区划代码本身为公开国家标准。
- **committed 文件**：`01-gov-approval/divisions.json`（6 个真实市辖区：徐汇/浦东/朝阳/福田/西湖/武侯）
  `sha256 77f3a702d84504f20527c3bf5f1aa812d0dec533f572033c2357bc4d72d02a34`
- **字段映射（→ 申报）**：`code→申报编号前缀的行政区划码`、`province/city/name→受理机关所在区划`。政务服务事项名取自公开事项目录（真实）；申报案件与申报人 PII 无公开来源，保持合成并标注。

## 案例二 · 合同管理 — GB/T 2260 省 + 市（相对方注册地校验集）

- **来源**：modood/Administrative-divisions-of-China（GB/T 2260，同案例一）
  <https://github.com/modood/Administrative-divisions-of-China>
- **许可**：MIT（代码）；区划代码为公开国家标准。
- **committed 文件**：`02-contract-ledger/regions.json`（373 条：省级 + 地级市）
  `sha256 318e69b31d3e0024542a8a0046660e07438c3f766096768743b10c479a87b86b`
- **字段映射（→ 合同）**：种子据此**校验**每个相对方名称前缀（上海/杭州/苏州/南京…）为真实行政区划，并记录注册地。相对方**企业名拟真但虚构**、金额为演示值；印花税按《印花税法》真实法定税率（买卖合同万分之三）计算示例。

## 保持合成的维度（无公开来源，均显式标注）

申报案件与申报人、审批意见与经办人、合同相对方企业名与内部审批链、租户 API Key、示例设备的资产编号。这些维持"拟真但虚构"标注，不谎称真实。
