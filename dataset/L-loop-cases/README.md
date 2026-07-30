# L001–L003 Loop 输入合同

Loop 不再播放预写状态表。`code/labs/loop-runtime/run_loop.py` 会读取真实本地输入并生成工件：

- L001 调用 `data-profile` 与 `metric-brief`，处理 5,000 条会员记录；硬检查通过后结束。
- L002 调用 `poster-recipe`，生成三套方向和可编辑 SVG；结构检查通过后停在视觉选择。
- L003 读取 MetroPT-3 的 25 条固定窗口和四条版本化资料；只生成现场检查申请，停在有权限的主管审批。

三个案例分别演示：通过即停、审美选择交给人、越权动作交给人。运行时不会调用图像 Provider、诊断设备或执行控制动作。
