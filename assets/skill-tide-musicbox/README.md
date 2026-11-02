# 🦭 潮汐音乐盒：十四日案例的过程材料

[第 10 章的案例正文](../../md/04-案例与实践篇/10-通用Skill案例-开发与设计.md#skill-tide-musicbox)按“输入 → Skill 实跑 → 人工选择规则 → 编曲台和试听 → 验收”叙述；此处保存可以打开或重放的原始材料。历史过程另行留存，不混入这一份十四日案例的证据链。

## 真实输入

- [原始请求的浏览器打印 PDF](source-14day-browser-print.pdf)、[恢复快照](recovered-14day-from-pdf.json)、[提取回执](extraction-14day-result.json)；`extract_tide_14day.py`、`test_extract_14day.py` 记录两种提取路径与质量、时间连续性核验。打印件**不是**直接下载的 API JSON。

## 真正执行的 Skill

- [固定 GitHub 提交的原件 ZIP](skills-321658273cb1d20b76026717d027d505790106d4.zip)和[本案例的目标目录人工审查与使用边界](14day-logic/SOURCE.md)：按其中 `skills/engineering/prototype/SKILL.md` → `LOGIC.md` 实际制作规则试件。
- [制作前的原始输入](14day-logic/PROMPT-ORIGINAL.md)（[易读版](14day-logic/PROMPT.md)为同一任务事后整理）→ `14day-logic/prototype14-logic-core.js`、`14day-logic/prototype14-logic.template.html`、`14day-logic/build_prototype.py` → [离线单文件 LOGIC 试件](14day-logic/prototype14-logic.html)。[执行回执](14day-logic/RUN-REPORT.md)、[核心单测](14day-logic/prototype14-logic.test.cjs)、[浏览器自动操作脚本](14day-logic/verify_prototype.cjs)、[浏览器结果](14day-logic/browser-check.json)、[桌面截图](14day-logic/prototype-desktop.png)与[手机截图](14day-logic/prototype-mobile.png)留存了补测和初次手机溢出的修正。原型在已有工作台之后补做，不将时间倒置。

## 可编排的产品与同源声音

- [十四日离线编曲台](tide14-studio.html)，源码 `tide14.template.html` / `tide14-model.js` / `build_tide14.py`；[正式模型测试](tide14.test.cjs)、[浏览器实际回执](tide14-browser-check.json)、`verify-tide14-browser.cjs`、[桌面](tide14-desktop.png)与[手机操作](tide14-mobile-viewport.png)截图。
- [A · 旧规则](十四日-演示原始映射.wav)、[B · 新规则](十四日-演示新规则未改编.wav)、[C · 人工改编](十四日-演示人工改编.wav)使用同一批 48 个源点、192 拍。[C 的可导入配方](十四日-演示人工改编-配方.json)标明 6 处逐音改动；[生成脚本](make-tide14-examples.cjs)支持重现三份音频。

双击 HTML 即可打开，无需联网。无头浏览器的“可播放”不等于它替人听过作品；新规则经人工试听选定，主观评分未记录。其他阶段的归档文件虽仍保留，不作为本次十四日 Skill 补测的输入和结果。
