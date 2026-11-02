# 潮汐规则试件：上游 Skill 来源与实际使用边界

使用的上游为 `mattpocock/skills` 固定提交 `321658273cb1d20b76026717d027d505790106d4` 中的 `skills/engineering/prototype/`，原件保存在[固定版本 ZIP](../skills-321658273cb1d20b76026717d027d505790106d4.zip)。ZIP SHA-256：`a1f244fa3ac2caa9b8316f333fd56ff25f31d6f1b52bd415775727d8464ec109`；其中包括该目录的 `SKILL.md`、`LOGIC.md`、`UI.md`、`agents/openai.yaml` 以及上游仓库的 MIT `LICENSE`。提交号和文件指纹用于核对本次使用的固定版本，不表示整个上游仓库的最新状态。

制作前人工阅读目标目录：主 `SKILL.md` 先要求明确原型验证的问题；本例实际使用 `LOGIC.md` 的逻辑试件路线，按其逻辑与界面分开、状态可见、自由操作和引导情景的要求制作[离线试件](prototype14-logic.html)。没有执行无关的上游脚本，也没有把 `UI.md` 路线写成此次的另一个 Skill 成果。[制作前输入](PROMPT-ORIGINAL.md)、[运行回执](RUN-REPORT.md)、[状态测试](prototype14-logic.test.cjs)和[浏览器结果](browser-check.json)分别记录输入、执行、代码检查与页面操作。

目标文件人工审查结论为 **CAUTION**：没有发现目标指令要求读取密钥、外传数据或持久化安装，但没有运行独立静态扫描，也没有对整个 ZIP 中其余 Skill 出具安全保证。此次是已有十四日编曲台之后的规则补测；Skill 的作用是约束试件如何验证映射与状态，**不是自动生成编曲台或替人选定音乐规则**。真实潮位的核验与人工试听选择各有独立记录。
