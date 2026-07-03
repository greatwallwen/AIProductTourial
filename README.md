# PM Transformation Hands-on Knowledge Base（产品经理转型实操知识库）

A hands-on knowledge base that helps engineers and project managers transition into product management. One PM workflow (role-shift → user insight → requirements → positioning → design → metrics → AI collaboration → QA → capstone) runs across **19 real industry scenarios**, each delivered as: **real data → runnable React prototype → real screenshot → two deliverables → handbook chapter → machine-verified**.

- Datasets: `dataset/` (+ `MANIFEST.md`, real vs. synthetic explicitly labeled)
- Runnable workbench: `coderef/react_pm_cases` (Vite + React + TS, one route per case `#/case/NN`)
- Manifests / SVGs / deliverables: `outputs/product_case_library/`
- Structured skills (46): `outputs/07_skills/pm_skills.md`
- Screenshots: `assets/screenshots/`
- Master handbook (Chinese): `产品经理转型实操知识库.md` · Chinese README: `README-cn.md`

## Quickstart

```bash
node coderef/fetch-datasets.mjs && node coderef/build_case_data.mjs
node coderef/build-manifests.mjs && node coderef/build-skills.mjs && node coderef/build_docs.mjs
cd coderef/react_pm_cases && npm ci && npm run build && npm run preview   # http://localhost:4173/#/
node coderef/verify_course_package.mjs   # ALL GREEN
```

## Guardrails

- Real vs. synthetic data explicitly labeled in `MANIFEST.md`; never claimed as real when synthetic.
- High-impact industries (finance/healthcare/gov/banking/insurance) keep human review — no auto credit/penalty/diagnosis/transaction-rejection.
- Every case is runnable and machine-verified (`verify_course_package.mjs`, ALL GREEN).
