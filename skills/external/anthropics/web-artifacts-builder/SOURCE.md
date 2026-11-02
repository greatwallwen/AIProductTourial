# web-artifacts-builder 上游来源

- 仓库：`anthropics/skills`
- 路径：`skills/web-artifacts-builder`
- 固定提交：`dbd4588f9e1033efb41dad4bef2f7947c8993d44`
- 原始文件：`SKILL.md`、`LICENSE.txt` 和 `scripts/` 下三个文件，保持上游内容不变。
- 授权：该 Skill 自带 `LICENSE.txt`（Apache-2.0）。

审查结论：`CAUTION`。本地没有 `skillspector`，已逐个检查说明文件、两个 shell 脚本、组件压缩包清单；未发现凭据读取或外传逻辑。原初始化脚本可能全局安装 pnpm，并安装大量未锁定版本的依赖；打包脚本会删除工作目录中的 `dist` 和 `bundle.html`。此前的功能基线没有执行原脚本；不能把早先的页面开发也归功于这项 Skill。

2026-10-29 为核查 Skill 实际作用，在仓库外隔离工程中执行**原版**初始化和打包脚本，生成[最终交付页面](../../../../code/cases/bedroom-layout-studio/skill-web-artifacts-builder/README.md)。该页面使用与先期代码相同的模拟输入与纯几何判断；原脚本生成工程并打包页面，未提供房间测量或布局算法。原脚本未修改；[实际 Prompt、运行日志和浏览器结果](../../../../assets/skill-bedroom-layout/skill-run/README.md)随案例保存。依赖版本漂移、构建策略与隔离处理见该记录；这些操作不改变 `CAUTION` 审查结论。
