# AI 时代产品工程：从业务问题到可验证智能系统

模型会生成文字之后，产品经理和工程团队仍要回答：材料从哪里来，数字怎么算，动作由谁批准，出了错怎样恢复。课程沿着这四个问题，把业务要求逐步变成可检查的 Prompt、可调用的 Skill、会停下来的 Loop，以及能留下数据和操作记录的产品。

课程主线是：

`逻辑与证据 → Prompt → Agent + Skills → Grill / Harness / Loop → 产品与系统架构 → 工程与交付 → 24 个业务案例`

- [教程目录](md/README.md)
- [24 个案例](md/cases/README.md)
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

浏览器打开 `http://127.0.0.1:3200`。首页先显示七层能力地图，当前课程可以手动点亮对应能力；从“案例驾驶舱”进入 24 个工作台后，可以恢复固定演示对象、执行主要业务动作并查看状态变化。运行环境需要 Node.js 24 及以上版本。

## 课程里有什么

| 层次 | 内容 | 实操 |
|---|---|---|
| Prompt | 六步，共 18 个实验 | 任务、参照、角色、数据、工具和回归检查 |
| Agent + Skills | S001—S009，含 9 个可运行 Skill | 数据体检、经营简报、机会图、海报、PPTX、小游戏、3D 与状态动效 |
| Loop | L001—L004 | 生成—检查、数据回查、长任务恢复和代码修复 |
| 产品工程 | 需求、数据合同、C4、DDD、事件和微服务 | 从业务决定走到可运行系统 |
| 综合案例 | B001—B024，分为经营服务、复杂协作、工业现场和日常数据产品四组 | 24 个 React + Next.js 工作台 |

## 目录

```text
AIProductTourial/
├─ md/                              # 规范章节与案例正文
├─ output/Course_AIProduct.md       # 按需生成，不提交
├─ code/                            # React 19 + Next.js 16 驾驶舱与实验
├─ dataset/                         # 课堂数据、来源与许可边界
├─ assets/                          # 理论图、需求图、架构图与场景素材
├─ evidence/                        # 运行截图和可复核的实验产物
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
python tools\compose_course.py build
python tools\compose_course.py check
python tools\validate_datasets.py --all
python tools\verify_course.py
python tools\verify_business_case_contracts.py

Set-Location code
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

本地数据、页面和实际运行结果只说明课程样本能够在当前工程中复现；企业系统是否接入、经营结果是否改善，以及高影响行业中的最终决定，都需要另外核实。
