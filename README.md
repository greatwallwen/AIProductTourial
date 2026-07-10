# Self-Verifying AI Engineering Handbook（会自检的 AI 工程 · 实操手册）

In one line: **go from doing the work yourself to designing a system that does the work and checks itself.** The course teaches bounded Loops, discoverable Skills, MCP contracts, evidence-driven evals, and human gates through **6 modules and 12 required activities**. The **9 representative industry cases** remain a source library, reorganized into three end-to-end practice tracks instead of nine duplicated walkthroughs.

- Datasets: `dataset/` (+ `MANIFEST.md`, real vs. synthetic explicitly labeled)
- Runnable workbench: `code/web` (Vite + React + TS, one route per case `#/case/NN`)
- Course contract and runnable labs: `course/` + `code/labs/`
- Source diagrams / deliverables: `outputs/product_case_library/`
- image2-optimized publication graphics: `assets/course/image2/`
- Structured skills (28): `skills/pm_skills.md` plus spec-aligned fixtures in `course/fixtures/skills/`
- Screenshots: `assets/screenshots/`
- Tutorial (Chinese, multi-file): `AI时代研发产品项目一体化知识库/` (its `README.md` is the index) · Chinese project README: `README-cn.md`

## Quickstart

```bash
node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs
node code/tools/build_docs.mjs   # 生成多文件教程 + 架构图 + 交付物
node code/tools/audit_learning_course.mjs
node code/tools/build_html_ppt_course.mjs
node --test code/tools/course_contract.test.mjs code/tools/check_my_work.test.mjs
bash code/run.sh   # 一服务托管 API+前端 http://localhost:5200/#/
node code/tools/verify_course_package.mjs   # ALL GREEN
```

## Guardrails

- Real vs. synthetic data explicitly labeled in `MANIFEST.md`; never claimed as real when synthetic.
- High-impact industries (finance/healthcare/gov/banking/insurance) keep human review — no auto credit/penalty/diagnosis/transaction-rejection.
- Every case is runnable and machine-verified (`verify_course_package.mjs`, ALL GREEN).
- Course completion requires structured evidence, an 80-point minimum, and engineering, product, and assurance reviews.
