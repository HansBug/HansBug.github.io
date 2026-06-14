# BanG Dream 桌宠资源分级审计数据集

本目录由 `scripts/build_bangdream_resource_audit.py` 生成，用来承载 PR #24 的资源审计主表和证据索引。

当前生成时间：`2026-06-14T12:19:56Z`

## 入口命令

```bash
npm run deskpet:audit -- --limit 20
npm run deskpet:audit -- --all-current-pool
npm run deskpet:audit -- --verify
```

默认命令会生成完整基础审计表，但只在终端输出 `--limit` 控制的小批量预览；下载、转换、真实浏览器渲染、animetimm 推理和复核字段保持 fail-closed 的 `pending` / `unknown`。

## 关键口径

- `row_kind` 是单值主分类：`current_pool | covered_candidate | union_only`。
- `is_union_reference` 表示资源是否存在于 Bestdori 五服 `live2d.chara` union 中，可以和 `is_current_pool` / `is_covered_candidate` 同时为 `true`。
- `final_content_rating` 只允许 `general | sensitive | questionable | explicit | unknown`；工程拒绝写入 `content_policy_decision=reject`。
- `policy_reject_count` 来自 `content_policy_decision`，不是 content rating。
- `tag-rating-mapping-v1.json` 是 tag->rating 和低置信阈值的唯一事实源。

## 文件

- `audit.parquet`：完整主表。
- `audit.csv`：reviewer 轻量视图，UTF-8 with BOM。
- `audit.schema.json`：字段、枚举和 CSV 列约束。
- `source-snapshot.json`：gist / Bestdori / current pool / tagger source snapshot。
- `evidence-index.parquet` / `evidence-index.csv`：证据索引。
- `family-summary.csv`：按 family 汇总的快速检查表。
- `resource-intelligence-summary.json`：机器可读统计摘要。
