# aiagent 图包许可待办（商业发售前必须关闭）

状态：`assets/vendor/aiagent/`（55 张 PNG，源自用户提供的 `AI agent/` 参考包）**未附 LICENSE / README / 作者授权说明**。教学自用可先行；**商业发售前须二选一**：① 联系原作者取得书面授权（邮件/协议留档到本文件）；② 按下表逐张替换为自绘 SVG（本仓库 `code/tools/diagram.mjs` 引擎可产同等示意图）或有明确许可的替代图。授权动作为用户侧事项；本文件是替换预案与清单。

## §1 正文直接嵌入的 5 张（优先级最高——出现在书正文，发售即分发）

| 文件（assets/vendor/aiagent/） | 用途（正文 alt 文本） | 位置 | 替换预案 |
|---|---|---|---|
| image-20260704090742433.png | Tokenizer 编码：文字→Token→Token ID | docs/_source/00-ai-foundations.md L41 | 自绘：diagram.mjs 三段流水线图；或改指 `#/lab/tokenizer` 活演示截图（自有） |
| image-20260704151540085.png | RAG 回答流程：Embedding→向量库→召回 10→重排→3 片段→大模型 | docs/_source/00-ai-foundations.md L61 | 自绘：与 fig_sdd_pipeline 同引擎的节点-连线图；语义与案例 04 一致 |
| image-20260704093622372.png | System Prompt 定规矩 · User Prompt 定任务 | docs/_source/00-ai-foundations.md L77 | 自绘：双栏对照卡（诸章已有同风格 SVG） |
| image-20260704102308686.png | Tool 工具调用：用户/平台/大模型/工具 四方协作 | docs/_source/00-ai-foundations.md L93 | 自绘：四方时序图（diagram.mjs 已支持 fig_req_sequence 同款） |
| image-20260704154121684.png | Agent 的 ReAct 完整闭环：思考→调用工具→观察→再思考 | docs/_source/00-ai-foundations.md L106 | 自绘：环形闭环图（fig_loop_cybernetic 同引擎） |

## reference/ 参考文档引用的其余 50 张（次优先——reference 为附属深读材料）

- `docs/_source/reference/rag.md`：21 张
- `docs/_source/reference/ai-basics.md`：13 张
- `docs/_source/reference/ai-agent.md`：11 张
- `docs/_source/reference/agent-skill.md`：4 张
- `docs/_source/reference/mcp.md`：2 张

若无法取得整包授权，最小代价路径：替换上表 5 张正文图 + 将 `docs/_source/reference/` 5 份文档整体移出发售包（或仅保留文字并链接原始出处）。

## 决议记录（关闭本待办时填写）

- [ ] 已取得书面授权（留档：____）／已完成替换（commit：____）
