# Notice

## Upstream

This skill is a modified derivative of the `ast-grep` skill distributed in [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), tag `v5.1.60`, commit `9cfa9cc7f7c86f972b9b6513d526ca9d427e4109`.

- Exact upstream source path: `packages/shared-skills/skills/ast-grep/SKILL.md`
- Upstream component source record: `https://github.com/code-yeongyu/ast-grep-skill` at commit `3148c69` (`ast-grep` 0.45.0), as recorded by the OMO package's `SOURCE` file
- Component license: MIT License, reproduced verbatim in [LICENSE.md](LICENSE.md)
- Retained attribution: `Copyright (c) 2026 Yeongyu Kim`

The OMO repository-level license notice states that third-party components incorporated into the software remain under the original license supplied by the component owner, while content outside those components is offered under Sustainable Use License 1.0. The upstream `ast-grep` package has its own MIT license and identifies itself as MIT-licensed. This derivative therefore retains that component license. It does not copy OMO runtime, MCP-server, installer, helper-script, or other SUL-licensed implementation content, and it does not relicense any SUL-covered OMO content.

## Prominent Modification Notice

**This copy has been substantially modified from the pinned upstream skill.** The modifications include:

- Reduced the package to the independently installable `SKILL.md`, `LICENSE.md`, and `NOTICE.md` files required by this repository; upstream scripts, installers, tests, and reference files are intentionally not included.
- Removed OMO-specific deferred MCP tools, tool-registration behavior, cache locations, host paths, and bundled-runtime assumptions.
- Replaced the upstream bundled Python helper workflow with direct, host-neutral CLI guidance.
- Made ast-grep an explicit optional external dependency boundary. The skill checks whether `sg` or `ast-grep` is actually the ast-grep executable, accounts for the Linux `setgroups` name collision, and does not install software automatically.
- Preserved the applicable structural-search decision rule, metavariable model, complete-code requirement, single-quote guidance, language selection, bounded search, zero-match diagnosis, and YAML-rule workflow.
- Preserved and strengthened the safety invariant that every rewrite is searched and previewed before a separate apply pass, followed by change inspection and repository verification.
- Removed links to omitted package-local references and replaced them with self-contained guidance.

The upstream project and component are not responsible for these modifications.
