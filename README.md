# agent-skills

Portable Agent Skills from [agent-guardrails](https://github.com/agent-guardrails). This repository holds many independently installable skills in one place. Each skill lives at `skills/<name>/` and carries its own `SKILL.md`, `LICENSE.md`, and `NOTICE.md`.

The initial collection focuses on debugging and post-implementation review. More skills can be added without changing the installation model.

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
