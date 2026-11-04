# AGENTS.md

This repository follows the organization-wide rules at <https://github.com/agent-guardrails/.github/blob/main/AGENTS.md>. Read and apply them before making changes here.

## Scope

This is a public, portable collection of independently installable Agent Skills. Each skill belongs in `skills/<name>/` and must include `SKILL.md`, `LICENSE.md`, and `NOTICE.md`.

Do not create or change skill content without preserving the licensing and provenance rules below.

## Required workflow

- Every substantive change needs one issue or project card. Track this work at <https://github.com/agent-guardrails/.github/issues/23>.
- Work in a dedicated worktree. Keep the main checkout clean.
- Open a pull request for every change. Do not push directly to a protected default branch.
- Write public artifacts in English.
- Never add secrets, tokens, private endpoints, or credentials.

## Licensing and provenance

- A skill directory is authoritative for that skill's license. The root `LICENSE.md` does not override it.
- Keep upstream skills unchanged when distributing them as upstream-as-is content, including their copyright and license notices.
- For adapted upstream content, keep all required copyright and license notices, add a prominent statement describing the modifications, and record the exact upstream version and source path in `NOTICE.md`.
- Initial adapted content comes from public OMO v5.1.60 under SUL-1.0. Distribute that content only under the free, non-commercial terms required by SUL-1.0.
- Every new skill must carry its own `LICENSE.md` and `NOTICE.md`, even when its terms match another skill.

## Validation

There is no build step. Run these test and validation commands before requesting review:

```sh
npx --yes skills add . --list
if [ -d skills ]; then find skills -mindepth 1 -maxdepth 1 -type d -exec test -f '{}/SKILL.md' \; -exec test -f '{}/LICENSE.md' \; -exec test -f '{}/NOTICE.md' \; && ! grep -R --line-number --fixed-strings 'precommit-review' skills; fi
```

The GitHub Actions workflow in `.github/workflows/validate.yml` runs the same repository checks on pull requests and pushes.
