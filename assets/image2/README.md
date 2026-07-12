# image2 课程原型资产

本目录保存 HTML 讲师长课使用的 image2 概念图和产品原型图。它们用于建立视觉方向、解释业务边界和帮助讲师转场，不是运行截图，也不是证据回执。

## 使用边界

- `generatedBy` 固定为 `gpt-image-2`，文件身份、尺寸和 SHA-256 记录在 `manifest.json`。
- 图片不得写入或推导 `live`、`verified`、`certified` 等当前会话状态。
- 图片中的数值、队列和标签只作界面原型；课程口播必须回到 runtime evidence。
- `rightsStatus` 与 `humanReviewStatus` 保持为待人工复核；完成权利、错字、连接关系和课堂投影可读性审查前，不得标记为发布通过。
- 精确架构拓扑、连接关系和可复算图表继续使用代码生成 SVG/HTML。
- Lucide 图标和真实可运行页面截图不转成 image2，以免丢失语义、许可或证据真实性。

## 资产分组

- 方法：AI 概念链、三层 Loop、SDD 流水线、Skill 生命周期、Eval 缺口、RAG 工作台。
- 案例：A01、A02、A03、55、56、57 六个讲师演示原型。

任何图片变更都必须同步更新 `manifest.json`，并重新运行仓库验证。
