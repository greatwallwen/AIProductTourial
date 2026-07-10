# 实验 02 · Skill 包与供应链红队

活动 05 先验证一个渐进披露 Skill，活动 06 再验证扫描器真的会阻断投毒包。

```bash
node code/labs/skills/validate.mjs course/fixtures/skills/good/SKILL.md
node code/labs/skills/validate.mjs course/fixtures/skills/poisoned/SKILL.md --expect-blocked
```

合格 Skill 的 `name` 与 `description` 用于发现；工作流留在 `SKILL.md`；只有
任务需要时才加载 `references/`。不要把完整知识库塞进发现元数据，也不要把
安装、授权或危险命令藏进参考文件。

交付一份验证报告，至少包含加载了哪些资源、哪些资源未加载，以及投毒包被
哪条规则阻断。
