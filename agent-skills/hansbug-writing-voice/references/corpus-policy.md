# Corpus Policy

This policy controls how the HansBug writing voice Skill may use old-blog material. It applies before any crawler, manifest, excerpt, style profile, or review rubric uses content from `https://www.cnblogs.com/HansBug/`.

## Hard Boundaries

- Keep full raw article HTML, markdown, text, and crawler outputs only under `.cache/hansbug-writing-voice/corpus/`.
- Do not commit full old-blog article bodies to this repository.
- Commit only short excerpts that are necessary for style analysis.
- A single excerpt must contain no more than `120` Chinese characters.
- All committed excerpts from the same source article must contain no more than `300` Chinese characters in total.
- Every committed excerpt must include a source URL field named `sourceUrl` or `url`.
- Every committed excerpt must include a purpose field named `purpose` or `useFor`.
- If a source-site rule conflicts with this repository policy, follow the stricter rule.

## 抓取可行性审计

Before PR-1 adds or refreshes crawler output, record the audit result in the PR description or in a future machine-readable audit file:

| Field | Required content |
|---|---|
| `source` | The exact old-blog source URL or index page being used. |
| `tosCheck` | ToS / site policy checked, with date and conclusion. |
| `robotsCheck` | `robots.txt` checked, with date, relevant path rule, and conclusion. |
| `fetchFeasibility` | Whether automated fetching is allowed, rate-limited, disallowed, or unclear. |
| `fallbackPlan` | If automated fetching is disallowed or unclear, use manual short excerpts only. |

If ToS, robots, or network behavior is unclear, do not guess. Fall back to 手动摘录: manually quote only the minimum short excerpt needed for a specific style purpose, with `sourceUrl` and `purpose` / `useFor` metadata.

## Committed Excerpt Format

Markdown references may use fenced JSON blocks with the `hansbug-voice-excerpt` marker:

````markdown
```json hansbug-voice-excerpt
{
  "sourceUrl": "https://www.cnblogs.com/HansBug/p/example.html",
  "purpose": "macro-logic",
  "text": "这里放不超过一百二十个中文字的必要短摘录。"
}
```
````

JSON manifests may put excerpt objects under an `excerpts` array. The same required fields and length limits apply.

Use `purpose` / `useFor` values that explain why the excerpt is needed, for example:

- `macro-logic`
- `micro-pattern`
- `tone`
- `article-archetype`
- `negative-example`
- `review-rubric`

## Validation

Run this before committing any reference changes:

```bash
python3 agent-skills/hansbug-writing-voice/scripts/lint_voice_references.py agent-skills/hansbug-writing-voice/references
```

The lint gate must fail with a concrete file path and field or limit reason when an excerpt is too long, lacks `sourceUrl` / `url`, or lacks `purpose` / `useFor`.
