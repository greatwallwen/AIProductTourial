# AI 时代产品工程：从业务问题到可验证智能系统

这套课程从一个朴素的问题开始：模型会生成文字之后，产品经理和工程团队还需要负责什么？答案不是再背一套术语，而是把业务问题逐步变成可检查的 Prompt、可调用的 Skill、会停下来的 Loop，以及能留下数据和操作记录的产品。

课程主线是：

`逻辑与证据 → Prompt → Agent + Skills → Grill / Harness / Loop → 产品与系统架构 → 20 个业务案例`

- [分章目录](AI时代研发产品项目一体化知识库/README.md)
- [20 个案例](AI时代研发产品项目一体化知识库/案例/README.md)
- [案例数据](dataset/manifest.json)
- [运行代码](code/README.md)

## 先运行一个案例

Windows：

```powershell
.\run.bat
```

macOS 或 Linux：

```bash
./run.sh
```

浏览器打开 `http://127.0.0.1:3200`。首页用于选择案例；进入工作台后，可以恢复固定演示对象、执行主要业务动作并查看状态变化。运行环境需要 Node.js 24 及以上版本。

## 课程里有什么

| 层次 | 内容 | 实操 |
|---|---|---|
| Prompt | U01—U06，共 18 个实验 | 任务、参照、角色、数据、工具和回归检查 |
| Agent + Skills | S01—S08，含 8 个可运行 Skill | 数据体检、经营简报、机会图、海报、PPTX、小游戏和 3D 资产检查 |
| Loop | L01—L04 | 生成—检查、数据回查、长任务恢复和代码修复 |
| 产品工程 | 需求、数据合同、C4、DDD、事件和微服务 | 从业务决定走到可运行系统 |
| 综合案例 | B01—B20，覆盖电商、公共服务、医院运营和工业现场 | 20 个 React + Next.js 工作台 |

## 目录

```text
AIProductTourial/
├─ AI时代研发产品项目一体化知识库/  # 分章教程、专题与案例
├─ code/                            # React 19 + Next.js 16 驾驶舱与实验
├─ dataset/                         # 课堂数据、来源与许可边界
├─ assets/                          # 理论图、需求图、架构图、场景素材与运行截图
├─ runtime/                         # 可复核的实验产物
├─ skills/                          # 产品与 Loop 技能资料
├─ sources/                         # 来源账本
├─ tools/                           # 内容、数据和代码门禁
├─ course-manifest.json             # 课程结构真值
├─ run.bat
└─ run.sh
```

## 数据边界

仓库只保留课程实际使用、许可清楚且适合公开分发的课堂数据。体积过大的原始数据通过 `source-downloads.json` 提供下载地址和校验信息；受协议限制的数据只保留脱敏或确定性合成的课堂样本。真实数据、合成数据和受限来源在各案例的 `source.json` 中分别说明。

## 校验

```powershell
python tools\compose_course.py check
python tools\validate_datasets.py --all
python tools\verify_course.py
python tools\verify_business_case_contracts.py

Set-Location code
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

本地数据、界面和运行回执可以证明课程样本在当前工程中复现；它们不能证明企业系统已经接入，也不能替代真实经营结果或高影响行业中的人工决定。
