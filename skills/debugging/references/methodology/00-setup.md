# Phases 0 and 1: Environment Assessment and Journal

## Assess the environment

Read manifests rather than guessing from extensions: `pyproject.toml` or lock files for Python, `package.json` for JavaScript, `Cargo.toml` for Rust, `go.mod` for Go, and build metadata plus `file <binary>` for native targets. Then read the matching runtime guide.

Capture the actual interpreter or executable, complete launch command, debugger and application ports, debug symbols or source maps, required configuration and credentials, existing reproduction, and any watcher or supervisor that may restart the process. Check that the code being read is the code running.

Bound every inspection by frame count, row count, byte range, or time. Prefer one observation that distinguishes hypotheses over broad dumps. If a command's output is unpredictable, limit it before execution.

## Create a temporary journal

Use one project-local `.debug-journal.md`, or an equivalent temporary note when the repository cannot be modified. Exclude it locally without changing committed ignore files. Never overwrite an existing exclusion file; append only after inspecting it.

```markdown
# Debug Journal: <bug>
Started: <ISO timestamp>
Goal: <reported outcome>

## Environment
- Runtime and version:
- Entry command:
- Ports and processes:
- Revision and pre-existing changes:
- References read:

## Hypotheses
1. [STATUS] <claim> | evidence: <decisive observation> | likely fix: <brief>

## Failed rounds
- Round 1:
- Round 2:

## Artifacts and rollback
- [ ] <artifact or mutation> | rollback: <exact action>

## Findings
<!-- Timestamped verbatim values with source locations. -->

## Independent reframing

## Confirmed cause and fix
```

Journal before every temporary edit, process, port, fixture, trace, environment override, debugger project, or system change. Record the original state and exact rollback. Do not rely on a destructive version-control restore when a file had pre-existing user changes; preserve and reverse only the debugging edit.

If the action is privileged, system-wide, network-intercepting, binary-modifying, or reverse-engineering, stop and obtain explicit authorization before journaling and executing it.
