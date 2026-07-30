# 课程代码

`code/` 包含三类实现：Prompt 结果复核与 Loop 运行器、S01—S08 的本地 Skill，以及 B01—B20 的 React 19.2 + Next.js 16.2 产品案例。教程先用可复制 Prompt 讲业务与方法，需要读取数据或生成文件时再让 CodeBuddy 调用这里的 Skill。

## 目录

```text
code/
├─ app/                     # 驾驶舱、产品工作台、API 与浏览器测试
├─ cases/                   # B01—B20 的业务合同；内部 ID 保持 01—20
├─ labs/
│  ├─ prompt-curriculum/    # P01—P08 A/B 实验运行与报告
│  └─ loop-runtime/         # L01—L03 多步运行与停止条件
├─ skills/                  # S01—S08 可独立检查的本地 Skill
├─ case-runtime/            # 状态、类型化命令与本地回执
├─ design-system/           # 共用组件与设计令牌
└─ runtime/                 # 可重建的本地状态数据库
```

Prompt 案例以主教程中的可复制提示交付；Skill 与 Loop 在需要时生成本地工件，不要求网页路由。产品案例的公开路由是 `/cases/B01/work` 至 `/cases/B20/work`；浏览器只提交类型化动作，命令校验、权限和状态变化由服务端完成。

## 运行产品案例

在课程根目录运行：

```powershell
.\run.bat
```

修改源码使用 `.\run.bat dev`，重新生成生产版本使用 `.\run.bat rebuild`。全部产品页面由 `http://127.0.0.1:3200` 提供，不为单个案例重复安装依赖或启动独立服务。

## 校验

```powershell
Set-Location code
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

各 Skill 和运行器包含自己的聚焦测试，维护时按各目录说明执行。测试、构建和截图只证明本地实现；外部 Provider、CodeBuddy、MCP/A2A 和真实经营结果必须分别取得新回执。
