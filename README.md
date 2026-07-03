# 信息化产品系统架构设计实操教程

一份面向**有经验开发者**的实操教程：从产品与业务出发，走完信息化产品系统架构设计的完整流程。同一套方法论（8 步流程），在四个典型领域各完整走一遍，证明一件事——**同样的流程 + 不同的约束 = 不同的架构**。架构不是技术选型清单，而是在特定约束下对质量属性做出的一组可追溯的决策。

> **单文件版**：[《信息化产品系统架构设计实操教程.md》](信息化产品系统架构设计实操教程.md)（由 `node scripts/build-single-md.mjs` 从 docs/ 合并生成，含全书 44 节、目录锚点与小节交叉链接）。这里的"44 节"= 21 个正文节 + 第 6 章 + 3 个附录 + 19 篇 ADR。`node scripts/build-single-md.mjs --embed` 另生成一份把 SVG/PNG 内联为 data URI 的自包含版本（脱离仓库也能看图）。
> 全书 34 张手写 SVG（其中 5 张含 SMIL 动画，浏览器打开可见流动效果）+ 4 张真实数据运行截图，4 个可运行工程共 94 个测试 + 37 个冒烟场景（01: 24/9，02: 30/9，03: 22/10，04: 18/9），`bash scripts/verify-all.sh` 实测全绿。四案例的数据集均为真实公开数据，已下载入 `dataset/`（清单/来源/许可/校验和见 [`dataset/MANIFEST.md`](dataset/MANIFEST.md)）。

## 内容地图

| 章节 | 内容 | 配套 |
|---|---|---|
| [第 1 章 方法论](docs/ch01-methodology/01-why-product-view.md) | 产品视角的架构设计 8 步流程 | 4 张图 |
| [第 2 章 政务事项申报审批](docs/ch02-gov-approval/01-business-and-constraints.md) | 等保三级 / 政务外网 / 信创约束下的模块化单体 | 工程 [01-gov-approval](code/01-gov-approval/) · 4 篇 ADR · 6 张图 |
| [第 3 章 企业合同管理](docs/ch03-contract-mgmt/01-business-and-constraints.md) | 组织权限 / 条件路由审批 / 异构集成 | 工程 [02-contract-ledger](code/02-contract-ledger/) · 5 篇 ADR · 7 张图 |
| [第 4 章 设备监控](docs/ch04-device-monitor/01-business-and-constraints.md) | 时序数据管道 / 有状态告警 / 写读分离 | 工程 [03-device-monitor](code/03-device-monitor/) · 5 篇 ADR · 8 张图 |
| [第 5 章 SaaS 多租户工单](docs/ch05-saas-ticket/01-business-and-constraints.md) | 租户隔离 / 订阅计费 / 水平扩展 | 工程 [04-saas-ticket](code/04-saas-ticket/) · 5 篇 ADR · 8 张图 |
| [第 6 章 四案例横向对比](docs/ch06-comparison.md) | 同一决策点的四种答案逐行展开 | — |
| 附录 | [A 模板五件套](docs/appendix/a-templates.md) · [B SVG 图形规范](docs/appendix/b-svg-style-guide.md) · [C 工程共用约定](docs/appendix/c-project-conventions.md) | — |

## 两条阅读路径

1. **顺读**：第 1 章 → 第 2~5 章 → 第 6 章。四个案例在同样的决策点上给出不同答案并互相引用（案例二的 ADR-001 会当面推翻案例一的 ADR-003），顺读能看到"上下文变了，决策就变"的完整对照网。
2. **第 1 章 + 你所在领域的那一章**：配合第 1 章，任一案例章可独立读懂——方法论细节通过链接回第 1 章，不重复展开。全书最大的价值（分岔对照网）需要顺读多章才能看全，案例章里指向其他案例的引用是"延伸"而非"前置依赖"，只读一章不影响理解本章。

## 运行示例工程

每章配一个独立可运行的示例工程（Fastify + TypeScript，零构建、零外部服务，详见[附录 C](docs/appendix/c-project-conventions.md)）。**要求 Node.js ≥ 24**：低版本无稳定的 `node:sqlite`、不能直跑 `.ts`，会以 `Unknown file extension ".ts"` 等晦涩错误失败，或 `db:migrate` 静默不执行。四工程已用 `.npmrc engine-strict=true` 拦截安装，`shared/db.ts` 启动时也会显式报错提示升级。

```bash
cd code/01-gov-approval
npm ci
npm run db:reset     # 建库 + 种子数据
npm run verify       # 类型检查 + 测试 + 冒烟实录
npm start            # http://localhost:3001
```

四个工程一次性全部验证（`verify-all.sh` 用到 bash 特性，Windows 请在 WSL 或 Git Bash 下运行）：

```bash
bash scripts/verify-all.sh
```

## 真实性声明

- 教程中引用的方法与标准（C4 模型、arc42、ADR、ISO/IEC 25010:2023、GB/T 22239-2019、GB/T 2260、《印花税法》等）均真实存在，正文标注出处；
- 正文中的 curl 请求与响应 JSON 均复制自示例工程的冒烟实录，非手写；页面截图为工程真实运行页面的无头浏览器抓取；
- **数据集为真实公开数据**，已下载入 `dataset/`（清单、来源 URL、许可、校验和、字段映射见 [`dataset/MANIFEST.md`](dataset/MANIFEST.md)）：案例三遥测取自 UCI-447《液压系统状态监测》（ZeMA/萨尔大学，CC BY 4.0），案例四工单取自三个公开 GitHub 仓库（supabase/prisma/vercel）的真实 issue，案例一与案例二的受理区划、相对方注册地取自 GB/T 2260 全国行政区划；
- 无公开来源的维度保持"拟真但虚构"并显式标注，绝不谎称真实：申报人与案件 PII、审批意见与经办人、合同相对方企业名与内部审批链、租户账号与 API Key、设备资产编号；
- 全部图形为手写 SVG（规范见附录 B）与页面截图 PNG，可在任何浏览器渲染。
