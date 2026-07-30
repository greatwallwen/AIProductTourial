# CodeBuddy 官方操作资料卡

核对日期：2026-07-29

## 采用的官方页面

- [CLI 快速开始](https://www.codebuddy.ai/docs/cli/quickstart)：Windows、macOS、Linux 可用；npm 包名为 `@tencent-ai/codebuddy-code`；启动后需要登录。
- [CLI 命令参考](https://www.codebuddy.ai/docs/cli/reference)：默认进入交互会话；`-p` 用于单次输出，`--output-format` 控制结果格式，`--tools` 可以收窄可用工具。
- [CLI 交互模式](https://www.codebuddy.ai/docs/cli/interactive-mode)：默认权限模式会在工具调用前确认；课程不采用跳过权限模式。
- [IDE 安装与登录](https://www.codebuddy.ai/docs/ide/Getting-Started/Installation)：Windows 和 macOS 使用独立 IDE，安装后仍需完成登录。

## 本课程采用的操作口径

IDE 是课堂主入口：打开 `Course_AIProduct`，让 Agent 先读当前案例的数据、规则和测试，再实施一个有明确停止条件的小改动。CLI 只用于可重复的窄任务，先限制工具做只读规划，再在默认权限模式下确认编辑与测试。版本可用、帮助可读和模型往返是三件不同的事，分别记录。

## 当前机器核对

- CodeBuddy CN IDE 启动器：1.106.1，x64。
- CodeBuddy Code CLI：2.128.1，安装在 D 盘专用工具目录。
- CLI 单次模型请求返回“Authentication required”。因此本轮只确认 CLI 程序可运行，未确认 CodeBuddy 账号认证或模型回答。
