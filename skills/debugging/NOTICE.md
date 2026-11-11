# Notice

## Upstream

This skill is an adapted derivative of the debugging skill from [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), tag `v5.1.60`, commit `9cfa9cc7f7c86f972b9b6513d526ca9d427e4109`.

- Upstream source path: `packages/shared-skills/skills/debugging`
- Original license: Sustainable Use License 1.0, reproduced verbatim in [LICENSE.md](LICENSE.md)
- Retained notices: upstream project and license names, original third-party attribution in the DAP guide, and tool-project links retained where relevant

## Prominent Modification Notice

This copy has been modified. The modifications are substantial and include:

- Reworked the entry skill into a portable, independently installable Agent Skill with no required host product, private path, named agent class, team API, background-job API, or version-control command integration.
- Replaced fixed coordination commands with capability-neutral guidance: optional isolated parallel workers, optional independent reviewers, and a sequential fallback that preserves the same evidence standard.
- Reframed the three-perspective stuck-debugging consultation as independent reframing. The skill never claims independence when the host cannot provide an independent reviewer.
- Replaced fixed home-directory journal and coordination paths with project-local temporary artifacts and repository-neutral rollback guidance.
- Added explicit authorization gates before privileged, system-wide, network-intercepting, binary-modifying, process-injecting, or reverse-engineering actions.
- Marked shell commands as OS-specific examples and added a generic unsupported-runtime fallback.
- Intentionally omitted browser workflow material to match this repository's non-UI scope. Browser, UI, and visual-QA guidance are not part of this skill.
- Renamed DAP client identifiers to portable values, made the helper Node 22 native, and ported its test suite from Bun/TypeScript to Node's built-in `node:test` and `assert` facilities in `.mjs` files.
- Tightened DAP framing errors so malformed protocol frames are surfaced rather than silently discarded.
- Preserved and reorganized the evidence-driven method: runtime observations, artifact journal, three orthogonal hypotheses, optional parallel investigation, two-round independent reframing, reversible causal proof, failing-first regression, real-surface QA, cleanup, and final evidence gates.
- Retained and adapted the portable runtime, methodology, tool, and helper material relevant to the repository scope. Browser workflow material was intentionally omitted.

No permissive relicensing is claimed. Distribution and use remain subject to [LICENSE.md](LICENSE.md).
