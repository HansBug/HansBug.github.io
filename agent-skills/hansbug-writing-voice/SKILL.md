---
name: hansbug-writing-voice
description: Plan, draft, revise, review, and mechanically check Chinese blog writing so it follows HansBug's own technical-blog voice. Use when Codex or Claude is asked to write, rewrite, critique, or validate posts under src/content/blog/ or to maintain this repo-local HansBug writing voice workflow.
---

# HansBug Writing Voice

如果本仓库内的 Skill 不能被自动发现，先手动读取本文件，再按下方任务模式表只读取当前任务需要的 references。Do not assume that every future reference already exists in PR-0; paths marked `后续 PR 占位` are navigation contracts for later PRs, not broken-link blockers.

## Scope

Use this Skill to make Chinese technical blog writing sound like HansBug without copying old articles wholesale. Preserve the repo's existing `CLAUDE.md / AGENTS.md` writing rules when they are stricter.

Do not use this Skill to:

- fetch or commit full old-blog article bodies;
- bypass source-site ToS, robots, or copyright boundaries;
- implement citation, BibTeX, CSL, or site rendering features;
- replace the user's own judgment when the prompt asks for a product, engineering, or style decision.

## Task Modes

| Mode | Use when | Read these references |
|---|---|---|
| `构思` | Planning a new post, deciding angle, audience, structure, or boundaries. | `references/corpus-policy.md`; `references/sample-manifest.json`; `references/article-archetypes.md`（后续 PR 占位）; `references/macro-logic.md`（后续 PR 占位）; `references/prompt-recipes.md`（后续 PR 占位） |
| `写作` | Drafting a post or a large new section. | `references/corpus-policy.md`; `references/voice-profile.md`（后续 PR 占位）; `references/article-archetypes.md`（后续 PR 占位）; `references/macro-logic.md`（后续 PR 占位）; `references/micro-patterns.md`（后续 PR 占位）; `references/prompt-recipes.md`（后续 PR 占位） |
| `改写` | Rewriting existing text to become closer to HansBug's style while keeping meaning stable. | `references/corpus-policy.md`; `references/voice-profile.md`（后续 PR 占位）; `references/micro-patterns.md`（后续 PR 占位）; `references/anti-patterns.md`（后续 PR 占位）; `references/review-rubric.md`（后续 PR 占位） |
| `审阅` | Reviewing a draft or PR for style fidelity, clarity, and structural fit. | `references/corpus-policy.md`; `references/voice-profile.md`（后续 PR 占位）; `references/anti-patterns.md`（后续 PR 占位）; `references/review-rubric.md`（后续 PR 占位） |
| `检查` | Running deterministic gates or verifying reference materials. | `references/corpus-policy.md`; `scripts/lint_voice_references.py`; `references/review-rubric.md`（后续 PR 占位）; `scripts/check_hansbug_voice.py`（后续 PR 占位） |

## Workflow

1. Treat the repo's `CLAUDE.md / AGENTS.md` writing rules as higher priority when they are stricter or more specific.
2. Classify the task into one or more modes from the table.
3. Before loading references, state the selected mode and the files/scripts you intend to read.
4. Read `references/corpus-policy.md` before touching old-blog material, samples, manifests, excerpts, or crawler output.
5. Load only the mode-specific references that exist in the current PR stage.
6. If a required future placeholder is still absent, state that the current stage lacks that reference and continue with available rules instead of inventing its contents.
7. For writing tasks, keep the article's facts, topic, and user intent fixed; change voice, structure, emphasis, and phrasing only where that improves fidelity.
8. For review tasks, report style problems as concrete edits or examples, not vague taste judgments.
9. For check tasks, run deterministic scripts before relying on prose inspection.

## PR-0 Available Commands

Validate committed reference excerpts:

```bash
python3 agent-skills/hansbug-writing-voice/scripts/lint_voice_references.py agent-skills/hansbug-writing-voice/references
```

This PR-0 lint gate only protects excerpt metadata and length limits. Full corpus fetching, feature extraction, style rubrics, and multi-run forward-tests belong to later PRs.
