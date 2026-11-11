# Notice

This directory contains a modified derivative of the `review-work` skill from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), tag `v5.1.60`, commit `9cfa9cc7f7c86f972b9b6513d526ca9d427e4109`.

Upstream source path: `packages/shared-skills/skills/review-work`.

Original license: Sustainable Use License 1.0. The upstream license text is retained without changes in [LICENSE.md](LICENSE.md). Upstream licensing and copyright notices are retained. This derivative is not offered under an MIT or other permissive license.

## Modifications

This derivative has been substantially adapted for portable installation across agent hosts:

- Replaced host-specific agent APIs, compatibility tables, mailbox rules, and fixed agent locations with capability-based instructions while retaining the portable `external-research` and `independent-review` role names.
- Defined `external-research` as optional, bounded evidence collection for repository history, issue context, public specifications, or dependency documentation when local evidence is insufficient. It cannot implement, self-approve, replace independent review, or create a verdict lane.
- Removed dependencies on host-specific review loops, browser automation APIs, visual QA integrations, and named subagent protocols. Browser workflows, browser automation, screenshots, UI testing, visual QA, and TUI visual review are explicitly out of scope.
- Replaced mandatory command examples with optional host-neutral capability examples for source inspection, VCS history, issue tracking, and CI evidence.
- Made isolated VCS worktree use conditional rather than mandatory.
- Limited manual-QA evidence to CLI or terminal behavior transcripts, APIs, tests, builds, library or SDK consumers, and data, configuration, migration, or generated artifacts. Terminal visual presentation is excluded.
- Preserved and clarified the sequential two-lane gate: primary-reviewer real-surface QA, then exactly one `independent-review` role.
- Added fail-fast handling for manual QA failures and an evidence-backed QA matrix requirement.
- Added the goal, constraints, behavior, quality, security, context, QA evidence, and scope checklist for the independent gate.
- Added explicit APPROVE or REJECT gate verdicts and PASSED, FAILED, or INCONCLUSIVE final report rules.
- Made independent approval mandatory for PASSED. Missing reviewer capability, inaccessible evidence, or absent reviewer verdict yields INCONCLUSIVE rather than self-approval.
- Clarified that this skill reviews completed work only and does not publish comments or modify code.
