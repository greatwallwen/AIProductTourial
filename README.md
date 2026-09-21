# AI 产品工程案例教程

面向授课与实操，涵盖 Prompt、Skills、Loop、系统架构和行业案例。

- [课程目录](md/README.md)
- [案例索引](md/案例索引.md)
- [运行代码](code/README.md)
- [数据清单](dataset/manifest.json)

## 运行

安装 Node.js 24 或以上版本。Windows 双击 `run.bat`；macOS / Linux 执行 `./run.sh`。浏览器访问 `http://127.0.0.1:3200`。

## 文件位置

| 目录 | 内容 |
|---|---|
| `md` | 教程与案例，文件平铺 |
| `code` | 应用与实验代码 |
| `dataset` | 课堂数据与来源说明 |
| `assets` | 图形、媒体与截图 |
| `skills` | 技能资料；工程约定并入 [工程规范](md/11-工程规范与约束.md) |
| `tools` | 校验和生成工具 |
| `runtime`、`sources` | 运行产物与来源记录 |

数据的真实、合成或受限属性见各案例的 `source.json`。运行截图不代表已接入企业系统。

`runtime/` 保存教程引用的实验产物和回执，不是可整目录删除的缓存。`run.bat` 和 `run.sh` 分别提供 Windows 与 macOS/Linux 的安装、构建和启动入口。
