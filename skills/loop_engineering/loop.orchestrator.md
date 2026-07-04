# 循环编排器 · prompt 模板

以循环方式执行任务：
0. 对齐目标：写一行任务简报（目标/涉及文件/完成标准），传给 builder 与 checker。
1. 派 builder 实现（或修复上一轮失败）。
2. 派 checker 运行所有检查。
3. checker=ALL GREEN → 停止，展示 diff 与检查结果。
4. checker=FAILED → 把**完整失败报告原样转发** builder（不自行解读或过滤，行号/堆栈/中间输出对定位根因是关键）。
5. 回到第 1 步。
轮次：最多 5 轮，每轮声明 "Cycle N/5"。停机规则见 stop-rules.md，严格遵循。
