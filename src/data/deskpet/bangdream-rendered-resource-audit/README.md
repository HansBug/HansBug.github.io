# BanG Dream 最终渲染资源审计数据集

本目录由 `scripts/build_bangdream_rendered_resource_audit.py` 生成，用于 PR #28。

生成时间：`2026-06-15T11:15:36Z`

## 关键口径

- tagger 输入是最终渲染 PNG，不是 texture atlas。
- direct rating 只作为弱信号，不能单独决定 `public_candidate` 或 `easter_egg_candidate`。
- 本 PR 只产出数据侧审计资产，不接入 JS / Astro 运行时消费。
- `public_candidate` / `easter_egg_candidate` 是审计建议，不是线上准入。

## 重跑

```bash
python3 scripts/build_bangdream_rendered_resource_audit.py --refresh
python3 scripts/build_bangdream_rendered_resource_audit.py --verify
```

`--verify` 默认执行严格验收：covered candidate 必须全量渲染尝试，成功渲染行必须完成 tagger，dedup duplicate 必须有 pair 证据。调试小样本只能显式使用 `--allow-partial --verify`。
