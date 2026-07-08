# Self-Verifying AI Engineering Handbook（会自检的 AI 工程 · 实操手册）

In one line: **go from doing the work yourself to designing a system that does the work and checks itself.** One promise only: **learn to design self-verifying Loop systems** (Loops · Skills · verification/evals + humans at the gate). No prompt tricks, no job-hunting content, one storyline for any technical-minded reader. One shared workflow runs across **9 representative industry scenarios** (including dogfood cases where the book evals / builds itself), each delivered as: **real data → runnable React prototype → real screenshot → two deliverables → handbook chapter → machine-verified**.

- Datasets: `dataset/` (+ `MANIFEST.md`, real vs. synthetic explicitly labeled)
- Runnable workbench: `code/web` (Vite + React + TS, one route per case `#/case/NN`)
- Manifests / SVGs / deliverables: `outputs/product_case_library/`
- Structured skills (28): `skills/pm_skills.md` (+ `skill_lint.mjs` scanner)
- Screenshots: `assets/screenshots/`
- Tutorial (Chinese, multi-file): `AI时代研发产品项目一体化知识库/` (its `README.md` is the index) · Chinese project README: `README-cn.md`

## Quickstart

```bash
node code/tools/fetch-datasets.mjs && node code/tools/build_case_data.mjs
node code/tools/build_docs.mjs   # 生成多文件教程 + 架构图 + 交付物
bash code/run.sh   # 一服务托管 API+前端 http://localhost:5200/#/
node code/tools/verify_course_package.mjs   # ALL GREEN
```

## Guardrails

- Real vs. synthetic data explicitly labeled in `MANIFEST.md`; never claimed as real when synthetic.
- High-impact industries (finance/healthcare/gov/banking/insurance) keep human review — no auto credit/penalty/diagnosis/transaction-rejection.
- Every case is runnable and machine-verified (`verify_course_package.mjs`, ALL GREEN).
