# S05 图像 Prompt 与 Skill 对比

> 当前完成的是 Prompt 编译与结构检查。没有真实 Provider 回执，因此没有图片输出评分。

## 对比摘要

| 组 | 方法 | 字段覆盖 | 任务适配 |
|---|---|---:|---|
| A | 普通 Prompt | 2/7 | baseline |
| B | 人工结构化 Prompt | 7/7 | full |
| C | 模板 Skill | 7/7 | full |
| D | 强风格 Skill | 7/7 | partial |

## 完整 Prompt

### A：普通 Prompt

```text
为“雨天旧书店”设计一张竖版活动海报，标题是“雨落下来，书页慢下来”。
```

### B：人工结构化 Prompt

```text
Use case: ads-marketing
Asset type: 3:4 竖版活动海报
Primary request: 为“雨天旧书店”设计一张可直接发布的活动海报
Audience: 下班后想慢下来的城市读者
Scene/backdrop: 深蓝雨夜中的旧书店，画面安静、克制，不做热闹促销氛围
Subject: “雨线”、“暖黄橱窗”、“旧书脊”、“一盏灯”
Composition/framing: 3:4 竖构图；标题、活动信息、品牌文字形成清楚的三级层级；保留足够留白
Lighting/mood: 冷雨与单一暖黄灯光对比，表达下班后慢下来的情绪
Color palette: 米白、深蓝、暖黄与低饱和灰；不使用多色渐变
Text (verbatim): 主标题“雨落下来，书页慢下来”；辅助文字“躺进一页旧时光”、“周五 19:30 · 夜读与换书”；必备文字“SECOND PAGE BOOKS”、“入场免费”
Constraints: 所有指定文字逐字准确、各出现一次；雨线、暖黄橱窗、旧书脊和一盏灯必须可见；小尺寸仍可读；只输出一张完成海报
Avoid: “人物大特写”、“高饱和多色渐变”、“密集商业促销标签”、乱码、随机英文、额外活动信息、Logo、水印、拼贴过程板
```

### C：模板 Skill

```text
Selected template: Poster Layout System / 海报排版系统
Template ID: poster-layout-system
Example cases: case 345, case 5, case 10

Subject and task: 为“雨天旧书店”生成一张完成度高的活动海报，面向下班后想慢下来的城市读者。
Composition and layout: 3:4 竖版；采用编辑式不对称布局。标题位于上部主要阅读区，暖黄橱窗作为唯一视觉锚点，旧书脊集中在下部，细雨线连接上下空间。标题、活动信息、品牌文字形成清楚的三级层级，至少保留约 30% 安静留白。不要输出 moodboard、宫格或设计过程。
Visual style and materials: 当代编辑海报、克制的纸张颗粒、米白与深蓝为主色，只用一个暖黄色锚点；冷雨和暖光形成清晰对比。字体气质为现代宋体标题配中性无衬线正文。
Text and labels (verbatim): “雨落下来，书页慢下来”；“躺进一页旧时光”、“周五 19:30 · 夜读与换书”；“SECOND PAGE BOOKS”、“入场免费”。每段只出现一次，不得改写、漏字或增加随机文字。
Aspect ratio and output: 3:4 竖版单张完成海报。
Required subjects: “雨线”、“暖黄橱窗”、“旧书脊”、“一盏灯”。
Constraints and negative details: 禁止“人物大特写”、“高饱和多色渐变”、“密集商业促销标签”；禁止拼贴展示板、无关装饰符号、乱码、随机英文、Logo 和水印；保证标题层级和主视觉在手机缩略图中仍可辨认。
```

### D：强风格 Skill

```text
Skill preset: editorial_text_card
Input mode: text
Preview mode: skip
Original display mode: translation_only
Layout mode: large_whitespace_small_art
Style mode: editorial_metaphor_card
Ratio: 3:4

将“雨落下来，书页慢下来”转译为一张 3:4 竖版编辑隐喻海报，同时保留活动信息功能。面向下班后想慢下来的城市读者，整体像独立艺术出版页，不像商业促销模板。

只使用一个视觉隐喻：一张打开的旧书页像窄屋檐承接三条雨线，书页下方一个小型暖黄矩形代表旧书店橱窗灯光，旁边只保留少量旧书脊线条和一盏灯的轮廓。视觉隐喻占画面 15%–30%，其余为暖米白艺术纸留白。配色限定为深灰、米白、深蓝和一个暖黄强调色，无渐变。

Text (verbatim): 主标题“雨落下来，书页慢下来”；辅助文字“躺进一页旧时光”、“周五 19:30 · 夜读与换书”；必备文字“SECOND PAGE BOOKS”、“入场免费”。保留原句，不改写成鸡汤；所有文字逐字准确、各出现一次，文字总面积保持克制但活动时间必须可读。

避免完整雨夜场景、雨窗照片、人物情节、PPT 图标墙、毛玻璃卡片、手账贴纸、人物大特写、高饱和多色渐变、密集商业促销标签、随机英文、Logo、水印和额外文字。只输出一张完成海报。
```

## 当前结论边界

- A 组只覆盖主题和标题，无法约束受众、必备文字、主体、禁用项和比例。
- B/C/D 覆盖完整简报，但 C 增加的是模板检索与版式规则，D 增加的是强审美偏好。
- D 与活动海报的任务适配仅为 partial；风格更鲜明不等于业务交付更合适。
- 没有真实图片时，不能声称任何组在文字准确、构图或视觉质量上胜出。
