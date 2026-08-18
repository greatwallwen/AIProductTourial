# Agent + Skills 运行证据

8 个 Skill 均由当前代码和本地输入重新验证。S01–S07 的约定范围已通过；S08 的本地 GLB 与 Three.js 查看器已验证，外部 3D Provider 因没有授权调用与真实回执，保持 `blocked-not-verified`。

| Skill | 当前结果 | 正式工件 |
|---|---|---|
| S01 能力路由 | 5 个任务：3 个路由成功，2 个按合同停止 | [5 个文件](S01/receipt.json) |
| S02 CSV 数据体检 | 21,039 行、21 列、精确重复 0 行；六项污染物缺失数均由脚本逐行统计 | [2 个文件](S02/receipt.json) |
| S03 会员实验指标简报 | 5,000 名会员；成长分层 1,250 名；8 元全量发券名义上限为 10,000 元；收入与最近购买间隔明确不可计算 | [2 个文件](S03/receipt.json) |
| S04 产品机会图 | 4 条访谈流程记录生成 5 个节点、5 条关系；每个节点都保留来源引用 | [2 个文件](S04/receipt.json) |
| S05 雨天旧书店海报 | 三套方向均可比较，选中“雨夜橱窗”；本地 SVG 可编辑；没有冒充图像 Provider 结果 | [2 个文件](S05/receipt.json) |
| S06 Markdown 到可编辑演示文稿 | @oai/artifact-tool 生成 5 页可编辑 PPTX；5 张 1280×720 渲染图已检查；边界、重叠、溢出、空白页与备注检查全部通过 | [17 个文件](S06/receipt.json) |
| S07 北京空气数据清洁调度 | R 键重置为 45 秒，方向键将坐标从 120,160 移到 136,160；倒计时真实下降；控制台 0 error / 0 warning；浏览器截图保留完整游戏画面 | [8 个文件](S07/receipt.json) |
| S08 本地 3D 资产合同与查看器 | 本地 glTF 2.0 / GLB：3 个顶点、1 个三角形；Three.js 查看器生产构建已保留；Provider 未调用、无回执，严格标记 blocked-not-verified | [12 个文件](S08/receipt.json) |

## 聚焦门禁

- Skill 合同校验：8/8 通过。
- Python / Node / Artifact Tool 聚焦测试：33/33 通过。
- S06：5 页全部渲染为 1280×720 PNG；边界、重叠、文字溢出、空白页、标题、备注和来源块均通过。
- S06 导出限制：`docProps/app.xml` 的 Slides/Notes 仍为 0/0；实际压缩包含 5 个 slide XML 与 5 个 notes XML，结构审计按实际内容通过 5/5。
- S07：浏览器回执记录键盘移动、倒计时与重启；截图为真实 Chromium 运行画面，控制台无 error/warning。
- S08：本地 fixture 和 viewer 验证通过；Provider 没有被标为已验证。

## 复核命令

```powershell
python -B tools/verify_agent_skill_runtime.py --run-focused
```

机器可读的逐文件校验、命令回执与边界状态见 [report.json](report.json)。
