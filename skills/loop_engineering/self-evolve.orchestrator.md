# 自我进化编排器 · prompt 模板（对抗式红队 → 修复 → 三绿 → 再红队）

把本书的 builder/checker Loop 掉转枪口对准**本书自己**：让一个对抗式红队(critic)持续挑刺，把最狠的问题交给 builder 修、checker 验，直到红队挑不出高危问题。这是「harness + 自我进化 + 对抗式测试」在本仓库的落地，工具无关。

## 三个角色

- **critic（红队 / 对抗）**：`node code/tools/adversarial_review.mjs --json` —— **不是**过/不过门禁，而是主动挑刺、按严重度排出「下一步该修什么」的候选清单：数字口径漂移 / 测试覆盖漏洞 / 内容单薄 / 风格漂移(AI 套话·emoji) / 可疑超级词 / 悬空引用 / 巨文件。只读、只挑刺，写 `outputs/adversarial_review.json`。
- **builder（构建）**：认领 critic 的 HIGH 项，一次修一类根因、最小改动、不弱化守卫（见 `builder.role.md`）。
- **checker（门禁）**：`verify_course_package.mjs` + 后端 `node --test` + 前端 `vitest` 三绿（见 `checker.role.md`，只读隔离）。

## 循环

0. **对齐**：写一行简报——本轮要压掉哪一类 HIGH。
1. **红队**：跑 critic，读 `outputs/adversarial_review.json`，取 HIGH（无 HIGH 则取 MED）。
2. **修复**：builder 认领同类的 top-N，改**源**（`case_definitions.json` / `docs/_source/*` / `build_docs.mjs` / 前端组件 / 新增 `*.test.ts`），**不改产物**。
3. **再生成**：`node code/tools/build_case_data.mjs && node code/tools/build_docs.mjs`（若涉数据/文档）。
4. **门禁**：checker 跑三绿；红灯 → 把**完整失败报告原样**回传 builder（回第 2 步，不自行解读过滤）。
5. **回归红队**：再跑 critic，确认本类 HIGH 数下降、且没引入新 HIGH。
6. 回第 1 步。

## 停机规则（严守 `stop-rules.md`）

- **收敛即停**：critic 连续 **2 轮** HIGH = 0（对抗式意义上「挑不出高危」）→ 停，展示 diff + 两份报告。
- 同一 HIGH 连修两轮不掉 → 停、升级到人（可能 critic 判据要改，或问题需人决策）。
- 每轮成本上限：一轮只碰一类根因，避免大范围返工雪崩。
- **红线**：绝不许为了让 critic/checker 变绿而**弱化它们本身**（改判据要单独提出、人确认）——否则就是「验证剧场」（§2.9）。

## 备注

critic 是顾问不是权威：LOW 与部分 MED 可能误报（如哲学引文里的「必然」由人过滤）。真正要清零的是 **HIGH**——数字漂移、覆盖漏洞、风格漂移、悬空引用，这些客观、可自动判定。当前基础已就位：critic 脚本 + 首批前端对抗式测试（`Icon.test.ts` 图标名完整性、`screens.test.ts` 案例屏 dispatch 完整性）。下一步由本 Loop 逐步补齐 8 个前端组件的行为测试，把「回归只能靠人工截图」这条 HIGH 清零。
