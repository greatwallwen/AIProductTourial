# 高级 Agent 综合实验

同一条地铁压缩机检查任务串起普通 RAG、Agentic RAG、本地 MCP、A2A 任务交接、多角色冲突处理和人工决定。数据来自课程固定的 MetroPT-3 切片；代码只读本地文件，不诊断故障，也不调用设备控制能力。

## 离线重放

```powershell
python -B code\labs\advanced-agent-lab\run_lab.py `
  --output-dir evidence\runtime\advanced-agent-lab\offline `
  --provider offline
```

## qwen-plus 摘要

先在环境变量中配置 `DASHSCOPE_API_KEY`，再运行：

```powershell
python -B code\labs\advanced-agent-lab\run_lab.py `
  --output-dir evidence\runtime\advanced-agent-lab\qwen-plus `
  --provider dashscope `
  --model qwen-plus
```

回执不保存密钥和供应商响应标识。`final-report.json` 是确定性主结果，模型只把它压缩成四行课堂摘要。

## 测试

```powershell
python -B -m unittest discover -s code\labs\advanced-agent-lab\tests -p "test_*.py"
```
