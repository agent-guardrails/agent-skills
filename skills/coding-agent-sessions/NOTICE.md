# Notice

## Prominent Modification Notice

**This copy has been modified from the upstream OMO `coding-agent-sessions` skill.** It is a substantial portable adaptation and is not the upstream package as distributed.

## Upstream

This skill is an adapted derivative of the `coding-agent-sessions` skill from [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), tag `v5.1.60`, commit `9cfa9cc7f7c86f972b9b6513d526ca9d427e4109`.

- Exact upstream source path: `packages/shared-skills/skills/coding-agent-sessions/SKILL.md`
- Pinned source: <https://github.com/code-yeongyu/oh-my-openagent/blob/9cfa9cc7f7c86f972b9b6513d526ca9d427e4109/packages/shared-skills/skills/coding-agent-sessions/SKILL.md>
- Original license: Sustainable Use License 1.0, reproduced verbatim in [LICENSE.md](LICENSE.md)
- Retained notices: upstream project names, the Sustainable Use License name and terms, and the upstream `oh-my-opencode Software` wording in the license text

## Modifications

The modifications include:

- Replaced the bundled Python finder and its command examples with a host-neutral capability ladder for native session list, search, read, pagination, and child-session operations.
- Removed bundled scripts, platform reference files, fixed output contracts, product-specific database behavior, and troubleshooting instructions tied to local storage layouts.
- Removed hard-coded home-directory and product-data paths. The adaptation does not guess storage locations and falls back to a file or directory explicitly selected by the user.
- Removed any requirement for OMO, Python, a particular agent host, named subagent APIs, or a specific local database schema.
- Added mandatory bounded-scope rules for platform, account, project, date, directory, and result limits, including a prohibition on recursive searches of home directories, filesystem roots, and broad agent-data trees.
- Added authorization, data-minimization, redaction, non-persistence, and untrusted-transcript requirements to prevent disclosure of credentials, private data, and unrelated transcript content.
- Preserved the upstream goals of cross-agent discovery, fuzzy-query expansion, metadata-based candidate selection, parent-child session reconstruction, and evidence-based verification.
- Added an explicit user-guided location-selection fallback for hosts without native session discovery capabilities.

No permissive relicensing is claimed. Distribution and use remain subject to [LICENSE.md](LICENSE.md), including its free, non-commercial distribution limitations.
