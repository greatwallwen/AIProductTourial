# 书稿状态

更新时间：2026-07-23

## 当前阶段

第二版目录、项目型书稿定位和贯穿案例工作流已建立。

## 当前分支职责

`codex/book-contents-versions` 负责：

- 全书章程、目录、风格、术语和状态
- Chat 分工及交接规则
- 目录版本文件的归档说明

本分支不负责新增章节正文、案例或示例代码。

## 文件状态

| 文件 | 状态 | 下一步 |
|---|---|---|
| `codex/BOOK_CHARTER.md` | Active | 随项目定位变化维护 |
| `codex/OUTLINE.md` | Active | 以第二版目录 PDF 为基线 |
| `codex/STYLE_GUIDE.md` | Active | 写作时持续补充可执行规则 |
| `codex/GLOSSARY.md` | Active | 已加入检索增强生成与人工介入，可随时维护 |
| `codex/DECISIONS.md` | Active | 持续追加跨章节决定 |
| `codex/CHAT_WORKFLOW.md` | Active | 新 Chat 统一复制对应提示词 |
| `codex/docs/README.md` | Active | 新目录 PDF 按版本递增保存 |

## 新内容触发新分支的规则

以下情况创建新分支：

- 新增或重写章节正文
- 新增案例、可运行示例或图示资产
- 一次改动跨越多个正文文件
- 改变已批准的学习目标或核心定义
- 设计或扩充全书贯穿案例

仅修正错别字、失效链接或本控制层的状态记录，可继续在当前维护分支处理。

建议分支名：

- `codex/chapter-01-ai-foundations`
- `codex/chapter-02-loop-engineering`
- `codex/example-chapter-NN-short-name`
- `codex/review-part-01-continuity`
