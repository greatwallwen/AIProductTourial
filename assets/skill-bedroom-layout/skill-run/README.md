# 卧室试摆：最终 Skill 页面与真实运行证据

- [完整实际输入 Prompt](PROMPT.md)：在执行前保存，不是事后补写的课堂练习指令。
- [原版初始化日志](init-log.txt)、[原版最终打包日志](bundle-final-log.txt)：在仓库外的隔离工程中执行，原脚本不修改。官方软件源不可达时，获准改用镜像；最终在未批准第三方原生构建脚本的前提下成功打包。仓库忽略 `.log` 后缀，故同样的原始内容以 `.txt` 保存。
- [最终页面独立浏览器回执](browser-final-check.json)与[复跑脚本](verify-final.cjs)：从仓库里的离线 `bundle.html` 打开，只检查这一件交付物。冲突禁存、图上旋转、方案保存刷新后恢复、真实鼠标拖动、键盘移动、自定义家具与 PNG 下载通过；下载的 PNG 与展示图逐字节一致，手机无页面级横向溢出，页面错误和联网请求为零。复跑需 Node.js 20+、Playwright 和 Chrome；可通过 `PLAYWRIGHT_MODULE`、`CHROME_PATH` 指定本地安装路径。
- [最终页面初始图](skill-desktop.png)、[旋转冲突图](skill-conflict.png)、[手机图](skill-mobile.png)和[浏览器实际下载的 A/B PNG](skill-comparison.png)。A/B 图由自动化操作最终页面得到，不能冒充真人导出或真实住户的购买决策。

最终 `bundle.html` 的 SHA-256 为 `87b532afe46d719c8f69946237b5db351b6513fdee0f88b84ec6e7e84585448a`，见[可离线打开的最终页面及源码](../../../code/cases/bedroom-layout-studio/skill-web-artifacts-builder/README.md)。家具尺寸和几何判断来自人工编写的模拟输入与先期代码；Skill 的可核查作用是生成工程、提供 UI 组件和单 HTML 打包流程，不负责推荐最佳布局。原始 Prompt 中的阶段核查要求及对应原始回执不改写，早期页面及其导出结果归档在仓库外，不作为本案例的 GitHub 交付物。
