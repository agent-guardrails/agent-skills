# Notice

## Upstream

This skill is an adapted derivative of the `git-master` skill from [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), tag `v5.1.60`, commit `9cfa9cc7f7c86f972b9b6513d526ca9d427e4109`.

- Exact upstream source path: [`packages/shared-skills/skills/git-master/SKILL.md`](https://github.com/code-yeongyu/oh-my-openagent/blob/9cfa9cc7f7c86f972b9b6513d526ca9d427e4109/packages/shared-skills/skills/git-master/SKILL.md)
- Original license: Sustainable Use License 1.0, reproduced verbatim in [LICENSE.md](LICENSE.md)
- Retained notices: upstream project name, license name, and license terms

## Prominent Modification Notice

**This copy has been modified. It is not the upstream skill as published.**

The modifications are substantial and include:

- Reworked the skill as a portable, independently installable package without an OMO runtime, task API, named agent, hook, environment-prefix, or host-specific tool dependency.
- Replaced the mandatory load wording and harness invocation syntax with a capability-neutral trigger description.
- Made status inspection the explicit first phase for every mutation and expanded the evidence needed for worktree, branch, upstream, publication, divergence, and in-progress-operation state.
- Preserved and clarified explicit authorization boundaries: inspection, staging, committing, rewriting, stashing, pushing, force-pushing, destructive recovery, and checkout-changing bisect work do not authorize one another.
- Preserved atomic commits while replacing rigid file-count rules with behavior, dependency, and independent-revertability criteria.
- Preserved safe rebase, conflict-resolution, abort, reflog, and recovery guidance; added explicit dirty-worktree handling and post-rewrite verification.
- Preserved the requirement to use `--force-with-lease` rather than plain `--force`; added remote-tip revalidation, explicit expected-object guidance, and stop-on-lease-failure behavior.
- Expanded history archaeology guidance for pickaxe, regex, blame, rename, removed-path, reflog, and bisect investigations, including limits on what each result proves.
- Removed the upstream GitHub-only pull-request attachment workflow. This derivative assumes no particular forge, hosting provider, remote name, or default-branch name.
- Removed upstream co-author footer expectations and environment command-prefix requirements. This derivative does not impose attribution trailers or a command prefix.
- Added an evidence-based completion report covering authorization, repository state, verification, remaining changes, and actions that still require approval.

No permissive relicensing is claimed. Distribution and use remain subject to [LICENSE.md](LICENSE.md).
