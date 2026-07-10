# 会自检的 AI 产品工程 · 课程素材契约

本目录是教程进入 HTML-PPT 平台的单一事实源。正文仍在
`docs/_source/`，但模块、活动、评分、证据、图形和数据集边界不再从
Markdown 猜测。

## 课程结构

- `manifest.json`：课程目标、6 个模块、总时长与旧案例重组策略。
- `activities.json`：12 个必做活动、运行任务、提交格式与证据要求。
- `rubrics.json`：工程、产品、验证三个独立视角的评分规则。
- `visuals.json`：发布课程的自有图、image2 重绘图与真实截图清单。
- `datasets.json`：公开、合成、内部派生数据的许可与隐私边界。
- `labs/`：按纵向工作流组织的实验手册，不再按九个案例复制同一套步骤。

## 可复现命令

```bash
node code/tools/audit_learning_course.mjs
node code/tools/build_html_ppt_course.mjs
node --test code/tools/course_contract.test.mjs
node code/tools/verify_course_package.mjs
node code/tools/adversarial_review.mjs --json
node code/tools/multi_role_course_audit.mjs
```

生成结果写入 `outputs/html-ppt/ai-product-loop-course-package.json`，供
HTML-PPT 平台导入。学习者运行产生的尝试、日志和凭证不提交到教程仓库。
