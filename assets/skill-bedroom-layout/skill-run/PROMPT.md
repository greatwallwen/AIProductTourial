# 本轮输入 Prompt：固定使用 web-artifacts-builder

请读取仓库保存的 `skills/external/anthropics/web-artifacts-builder/SKILL.md`，严格按其要求使用原始 `scripts/init-artifact.sh` 新建隔离工程，开发交互页面，再由原始 `scripts/bundle-artifact.sh` 打包为可离线打开的 `bundle.html`；保存真实命令与运行结果。不要替换或冒充其他 Skill，遇到依赖或打包失败即停止并告知使用者。

输入是 `dataset/cases/bedroom-layout-studio/room-data.json` 与同目录 `room-plan.svg` 记录的模拟卧室：420×330 cm，北墙窗宽130 cm、南墙房门宽80 cm；床、衣柜、床头柜和候选书桌 A/B/C 的尺寸与位置以固定数据为准。不要从图片推测真实尺寸。可以复用现有源码中的纯几何计算及固定数据，以便保持同一判断合同；不要复制既有网页的完整组件/布局冒充本轮 Skill 新产物。

产出一个真实可试的多状态 React 界面：初始家具、加入候选或自填一件家具、图上拖动和旋转、越界/重叠/开门冲突阻止保存、保存恢复 A/B 并导出 PNG。适配桌面和手机，避免多余装饰。模型和 Skill 不代替人判断真实通道、搬运、采光或“最优”。

同时验收旧版与新打包版完成同一任务的情况：候选选择、旋转、冲突提示与禁存、A/B 保存刷新恢复、真实 PNG 下载、离线可用、手机与键盘。区别标明：旧版是早已有的实现和使用者亲自导出的 A/B 图，本轮 Skill 版是新生成的工程与浏览器成果；不得把二者混作同一次产出或隔离模型实验。
