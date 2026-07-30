# Prompt 课程实验输入

本目录为 P001—P008 的课堂实验提供固定输入：

- `P001.json`—`P008.json`：任务、参照、角色、追问、数据、任务卡、安全和回归检查的可复用清单；
- `agricultural-wholesale-price.csv`：1,104 行确定性合成的月度价格教学数据，字段为月份、品种、价格和类别；运行 `python tools/build_prompt_dataset.py` 可重新生成。

课堂以主教程中的完整 Prompt 为准。JSON 可用于重复比较同一组输入；CSV 用于 P005 的月度变化实验，不代表真实市场价格。模型回答不写回数据目录。
