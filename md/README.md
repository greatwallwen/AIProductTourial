# AI 时代产品工程

课程只有一条阅读主线。先理解模型与证据，再练 Prompt、Agent 与 Skills；随后进入 Grill、Harness、Loop、系统架构和工程交付；最后用二十四个业务案例完成综合练习。

1. [课程地图](00-课程地图.md)
2. [逻辑、证据与 AI 基础](01-逻辑证据与AI基础.md)
3. [Prompt 工程](02-Prompt工程.md)
4. [Agent 与 Skill 工程](03-Agent与Skill工程.md)
5. [Grill、Harness 与 Loop](04-Grill-Harness-Loop.md)
6. [产品与系统架构](05-产品与系统架构.md)
7. [工程与交付](06-工程与交付.md)
8. [二十四个综合案例](07-案例地图.md)
9. [课程项目](08-课程项目.md)

[案例索引](cases/README.md)列出每个业务问题、数据来源、运行入口和主要方法。[术语表](术语表.md)用于遇到概念时回查，不作为独立授课章节。

需要单文件版本时，在仓库根目录运行：

```powershell
python tools\compose_course.py build
```

生成结果位于 `output/Course_AIProduct.md`。它由本目录的章节与二十四个案例确定性合成，不作为第二份可编辑源文件提交到 GitHub。
