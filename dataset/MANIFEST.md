# 数据集清单（产品经理转型实操知识库）

为课堂可复现，除标注「真实」外均为**确定性教学合成**数据（固定种子生成，字段与结构对齐所引用的真实公开数据集；publicRef 见各案例）。**不把合成数据说成真实。** 生成：`node coderef/fetch-datasets.mjs`。

| 文件 | 行/项 | 性质 | sha256 |
|---|---|---|---|
| order_data.csv | 1200 | 教学合成（对齐 UCI Online Retail 352） | aafa45b27d21fb4f… |
| sku.csv | 300 | 教学合成（对齐 UCI Online Retail 352） | 32fa6f1becd042c7… |
| ex-17-RFM.csv | 800 | 教学合成（对齐 UCI Online Retail 352 衍生 RFM） | 75b8f77999153277… |
| product_cases/aicourse_hr_employees.csv | 145 | 教学合成 | 57cea00aa91fd7bd… |
| product_cases/aicourse_financial_transactions.csv | 900 | 教学合成 | f89218bdfc9d1adc… |
| product_cases/aicourse_logistics_delivery.csv | 700 | 教学合成 | 45e7ee80916d0905… |
| product_cases/aicourse_healthcare_diabetes.csv | 520 | 教学合成 | ba7e7bb16faaa4d8… |
| product_cases/aicourse_ecommerce_orders.csv | 1000 | 教学合成 | 7dfaaf48dc1fb8f5… |
| reference_data_analysis/28-creditcardfraud_sample.csv | 600 | 教学合成（对齐 UCI Bank/CreditCard） | 7d44876e026d5526… |
| reference_data_analysis/2-air_data.csv | 800 | 教学合成（航空会员 RFM） | af00cb9318ce191c… |
| reference_data_analysis/18-ad_performance.csv | 6 | 教学合成（广告投放漏斗） | dea1bef8ce455716… |
| pm_network_cases/nyc_311_service_requests_5000.csv | 1500 | 教学合成（对齐 NYC 311，联网失败回退） | 2b78768e19ef6c05… |

JSON 产物（方法论案例输入）：outputs/05_harness/prototype_test_report.json、outputs/11_loop_engineering/loop_report_sample.json、outputs/10_knowledge_gamification/knowledge_quest_bank.json、outputs/07_skills/pm_skills.md

## 本地化公开参考

- `skills/external/pm-skills-deanpeters/`：源 https://github.com/deanpeters/Product-Manager-Skills （MIT）；已 vendor 到本地，案例 02 引本地路径；194 篇 md 作向量检索(RAG)语料。

## 网络下载真实图形（vendored）

- `assets/vendor/lucide/`：**Lucide 图标**（来源 https://github.com/lucide-icons/lucide ，**ISC 许可**，见同目录 LICENSE）。10 个概念图标（brain/binary/layers/workflow/box/network/cpu/boxes 等）内联进 §1「AI 核心概念底层链路」图 fig_ai_foundations 加以优化。真实下载图形，非教学合成，已注明来源与许可。
