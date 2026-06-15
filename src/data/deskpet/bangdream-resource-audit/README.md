# BanG Dream 桌宠资源分级审计数据集

本目录由 `scripts/build_bangdream_resource_audit.py` 生成，用来承载 PR #24 的资源审计主表和证据索引。

当前生成时间：`2026-06-14T21:20:48Z`

## 入口命令

```bash
npm run deskpet:audit -- --limit 20
npm run deskpet:audit -- --skip-gist-fetch
npm run deskpet:audit -- --verify
npm run deskpet:audit:examples -- --force
```

默认命令会生成完整审计表，并对 Bestdori `buildData.asset` 中可取得的纹理运行 `animetimm/convnextv2_huge.dbv4-full` direct rating 推理；`--limit` 只控制终端预览行数，不裁剪输出数据。低置信或无法取得视觉证据的行保持 fail-closed，并进入 `llm-review-queue.csv` 或阻塞状态。
低置信且已经有 tagger 视觉证据的行会进入 `llm-review-queue.csv`；显式传入 `--run-llm-review` 时才调用外部 LLM 复核，结果写入 `llm-review-results.json` 并回填主表。无法取得视觉证据的行不会被 LLM 自动放行。
`render-completeness.csv` / `render-completeness.json` 由 JS 离线浏览器审计脚本生成，Python 端只负责消费并回填 current_pool 的真实渲染完整性证据。
`rating-examples.md` / `rating-examples/` 是人工查阅用的抽样渲染材料：按 `final_content_rating` 尽量抽取 20 个典型资源，用 Bestdori `buildData.asset` 临时镜像模型并通过本仓库同一套 Pixi/Live2D runtime 渲染成 PNG。该导出只服务审阅，不改主审计表，也不把资源接入 JS 端运行池。

## 关键口径

- `row_kind` 是单值主分类：`current_pool | covered_candidate | union_only`。
- `is_union_reference` 表示资源是否存在于 Bestdori 五服 `live2d.chara` union 中，可以和 `is_current_pool` / `is_covered_candidate` 同时为 `true`。
- `final_content_rating` 只允许 `general | sensitive | questionable | explicit | unknown`；`content_policy_decision=reject` 表示工程拒绝，不是内容分级。
- `policy_reject_count` 来自 `content_policy_decision`，不是 content rating。
- direct rating 来自 animetimm 模型的 `general/sensitive/questionable/explicit` 输出；`tag-rating-mapping-v1.json` 仍是 policy tag 和低置信阈值的唯一事实源。
- rating 样例图的当前分布为 `general=20`、`sensitive=20`、`questionable=15`、`explicit=0`、`unknown=20`；`questionable` 全表只有 15 行所以全部展示，`explicit` 当前全表没有行。

## 文件

- `audit.parquet`：完整主表。
- `audit.csv`：reviewer 轻量视图，UTF-8 with BOM。
- `audit.schema.json`：字段、枚举和 CSV 列约束。
- `source-snapshot.json`：gist / Bestdori / current pool / tagger source snapshot。
- `evidence-index.parquet` / `evidence-index.csv`：证据索引。
- `family-summary.csv`：按 family 汇总的快速检查表。
- `llm-review-queue.csv`：tagger 低置信或需要二次视觉判断的行。
- `llm-review-results.json`：外部 LLM 对低置信 tagger 结果的结构化复核输出。
- `render-completeness.csv` / `render-completeness.json`：current_pool 的真实浏览器渲染完整性审计结果。
- `rating-examples.md`：按 rating 展示典型资源、模型截图、分数、LLM 复核和策略决策的人工查阅表。
- `rating-examples/index.json`：样例选择、渲染输出路径和截图 SHA-256 的机器可读索引。
- `rating-examples/<rating>/*.png`：提交进仓库的典型资源 Live2D 渲染截图。
- `resource-intelligence-summary.json`：机器可读统计摘要。
