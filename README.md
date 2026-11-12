# agent-skills

Portable Agent Skills from [agent-guardrails](https://github.com/agent-guardrails). This repository holds many independently installable skills in one place. Each skill lives at `skills/<name>/` and carries its own `SKILL.md`, `LICENSE.md`, and `NOTICE.md`.

## Skills

- `ast-grep` searches and rewrites code by syntax-tree shape.
- `coding-agent-sessions` finds and reconstructs bounded coding-agent session history.
- `debugging` guides evidence-driven runtime debugging and real-surface fix verification.
- `git-master` handles Git inspection, history work, and explicitly authorized mutations.
- `lsp-setup` configures and verifies Language Server Protocol support.
- `review-work` reviews completed implementation through manual QA and an independent gate review.

More skills can be added without changing the installation model.

## Install a skill

Install one skill for a chosen agent:

```sh
npx skills add agent-guardrails/agent-skills --skill <name> -a <agent>
```

Add `-g` to install it globally:

```sh
npx skills add agent-guardrails/agent-skills --skill <name> -a <agent> -g
```

Check installed skills, update them, or remove one:

```sh
npx skills check
npx skills update
npx skills remove <name>
```

## OpenCode v2 catalog

OpenCode v2.2.5 and later can load this repository as a remote skill catalog. Add the catalog base URL to `opencode.json`:

```json
{
  "skills": [
    "https://raw.githubusercontent.com/agent-guardrails/agent-skills/main/skills/"
  ]
}
```

OpenCode fetches `index.json` from that base URL, then downloads each listed file from the same origin at `<name>/<file>`. It refreshes a catalog skill when that skill's `version` changes in `index.json`.

Each version has the form `sha256:<64 lowercase hex digits>` and is derived from the package's sorted relative paths and exact file bytes. Adding, removing, renaming, or editing any package file requires regenerating that skill's digest in `skills/index.json`. Run `node scripts/validate-skills.mjs`; a stale version diagnostic reports the required digest for the current package content.

## Repository layout

```text
skills/
  <name>/
    SKILL.md    # Skill instructions and metadata
    LICENSE.md  # Terms for this skill
    NOTICE.md   # Provenance and required notices
```

Skills are portable by design. A skill may reference optional harness features when they improve the experience, but it must state those dependencies and remain useful without a private or product-specific environment.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Repository-wide working rules are in [AGENTS.md](AGENTS.md).

## License

This is a mixed-license collection. The authoritative license for a skill is the `LICENSE.md` inside that skill directory. See [LICENSE.md](LICENSE.md) for the repository-level explanation.
