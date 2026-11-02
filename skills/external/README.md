# 外部 Skill 来源

本目录只保留课程案例实际拟用、已核对来源的第三方 Skill；它们不是课程原创内容，也不代表案例已运行或通过验收。使用前按任务阅读具体 `SKILL.md`，不要自动执行附带脚本或安装依赖。

| 来源 | 本地目录 | 下载快照 | 随附许可 |
|---|---|---|---|
| [GitHub Awesome Copilot](https://github.com/github/awesome-copilot) | `github/awesome-copilot/exam-ready/` | 2026-10-18 直接下载 `main` 中的 `skills/exam-ready/SKILL.md`；SHA-256：`c3551239018434cb3cf080ce505b279efeaca8211a5c2d513d7c91b1a157e2ad` | `github/awesome-copilot/LICENSE`（MIT） |
| [Anthropic skills](https://github.com/anthropics/skills) | `anthropics/frontend-design/` | 2026-10-17 下载的 `main` ZIP，SHA-256：`149d804241449c2a382079de32e37032ba6a18eb7621ec20217ce4974e1fbc21` | 本目录的 Apache-2.0 `LICENSE.txt` |
| [Anthropic skills](https://github.com/anthropics/skills) | `anthropics/web-artifacts-builder/` | 2026-10-25 按固定提交 `dbd4588f9e1033efb41dad4bef2f7947c8993d44` 保存原件；人工审查与脚本使用边界见 `SOURCE.md` | Skill 自带 Apache-2.0 `LICENSE.txt` |
| [obra/superpowers](https://github.com/obra/superpowers) | `obra/verification-before-completion/` | 2026-10-17 下载的 `main` ZIP，SHA-256：`02dbd1df4d736aa8f6016c5e163ad613a1ffeea0d58def158e12aacd4a6a41d8` | `obra/LICENSE`（MIT） |

这里只复制课程实际用到的 Skill 与随附许可文件，未引入整个上游仓库。其他候选 Skill、ZIP 原件、下载核对和试运行材料不随课程仓库发布。

`github/awesome-copilot/exam-ready/` 只保存 Skill 文件，不保存整个上游仓库。该 Skill 不附带可执行脚本，已先做人工源审查；它只能依据提供的学习材料和考试范围整理复习内容，不能替代教师划定范围或验证教材之外的事实。

第三讲小测试跑还用现有 `obra/verification-before-completion/` 作为验收方法：核对页码、答案和浏览器交互。曾考虑 `anthropics/web-artifacts-builder`，但其上游明确注明不适用于简单的单文件 HTML；本次没有引入或运行它，不把未使用的 Skill 记入案例。

卧室试摆案例比第三讲小测多了家具拖动、碰撞提示、图上旋转及双方案存档。2026-10-29 在隔离工程实际运行 `anthropics/web-artifacts-builder/` 原版初始化与打包脚本，生成最终页面、截图和浏览器回执。模拟输入与纯几何判断沿用先期编写的案例规则；该 Skill 不负责识别真实户型，也不提供布局优化算法。版本漂移与执行边界见该 Skill 的 `SOURCE.md`。

正式版小测另参考 `anthropics/frontend-design/SKILL.md` 做页面设计复核：保留题目与判分不变，调整为试卷式层级、题号与材料回看入口，验证手机布局及键盘焦点。它只提供设计指导，不含自动生成页面的脚本；调整过程和截图保存在仓库外 `../extra/过程性材料/第三讲网络模型小测/`。
