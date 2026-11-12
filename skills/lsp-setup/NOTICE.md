# Notice

## Upstream

This skill is an adapted derivative of the `lsp-setup` skill from [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), tag `v5.1.60`, commit `9cfa9cc7f7c86f972b9b6513d526ca9d427e4109`.

- Exact upstream source path: [`packages/shared-skills/skills/lsp-setup/SKILL.md`](https://github.com/code-yeongyu/oh-my-openagent/blob/9cfa9cc7f7c86f972b9b6513d526ca9d427e4109/packages/shared-skills/skills/lsp-setup/SKILL.md)
- Original license: Sustainable Use License 1.0, reproduced verbatim in [LICENSE.md](LICENSE.md)
- Retained notices: upstream project name, skill name, license name, and license terms

## Prominent Modification Notice

**THIS COPY HAS BEEN MODIFIED.** The modifications are substantial and include:

- Reworked the skill into a self-contained, independently installable package that does not require bundled scripts, generated server tables, or per-language reference files.
- Replaced OMO-specific LSP tools, built-in server registries, config schemas, and fixed config paths with capability discovery against the active harness's own tools and authoritative documentation.
- Removed OMO's bundled detection, verification, and server-table scripts rather than presenting them as portable utilities.
- Removed harness-specific config examples from this slice. No OMO, Codex, OpenCode, or other product config file is claimed to be universal.
- Preserved the operational flow of detecting the project and harness, selecting and installing a server when needed, applying the smallest supported configuration, and verifying through a real diagnostics roundtrip.
- Added explicit approval gates before global or system-wide installs and before edits to user-level harness configuration.
- Added project-local installation preference, bounded troubleshooting by protocol boundary, persistent reload verification when practical, cleanup requirements, and an evidence-based completion report.

No permissive relicensing is claimed. Distribution and use remain subject to [LICENSE.md](LICENSE.md).
