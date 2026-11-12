# Contributing

Thanks for improving this public collection of portable Agent Skills.

## Before you start

Create or select one issue or project card for each substantive change. Use a dedicated worktree, keep public text in English, and open a pull request for review. Do not include secrets, tokens, credentials, or private links.

Read [AGENTS.md](AGENTS.md) for the repository rules and validation commands.

## Add a skill

Create one independently installable directory at `skills/<name>/`. It must contain:

```text
SKILL.md
LICENSE.md
NOTICE.md
```

Write the skill for broad portability. Optional harness integrations are allowed when documented as optional. Don't make a skill depend on a particular private environment or agent runtime unless that constraint is explicit in the skill itself.

## Choose a provenance path

### Upstream as-is

Use this path when copying a public upstream skill without changing its content. Preserve the upstream file contents, copyright statements, license text, and notices. The skill's `NOTICE.md` must identify the upstream project, exact version or revision, and source path.

### Adapted upstream content

Use this path whenever an upstream skill is changed. Preserve all upstream copyright and license notices. Put the governing terms in the skill's `LICENSE.md`, and write a prominent modification statement in `NOTICE.md`. Record the exact upstream version and source path there as well.

The initial adapted skills are based on public OMO v5.1.60 under SUL-1.0. Their distribution must remain free and non-commercial under SUL-1.0. Do not describe those skills as MIT licensed unless their own upstream terms allow it.

## Validate and submit

Keep the skill's `files` entry in `skills/index.json` complete and sorted. Every package change, including a file addition, removal, rename, or byte-level edit, requires a new content-derived `sha256:<64 lowercase hex digits>` version. Run `node scripts/validate-skills.mjs` and replace a stale version with the digest reported by the validator.

Run the commands in [AGENTS.md](AGENTS.md), then open a focused pull request linked to the issue or card. Keep unrelated cleanup out of the change.
