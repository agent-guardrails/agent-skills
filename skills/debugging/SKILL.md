---
name: debugging
description: Use for runtime debugging, crashes, hangs, silent failures, wrong responses, flaky tests, memory leaks, async races, debugger attachment, binary inspection, and authorized reverse engineering; follows an evidence-driven hypothesis loop and verifies fixes on the real user surface.
---

# Debugging

Debug from observed runtime state, not plausible code-reading stories. Keep a temporary journal of every artifact and restore the environment before completion.

## Reference gate

Before attaching or instrumenting, read the matching runtime guide:

- [Python](references/runtimes/python.md)
- [Node.js, TypeScript, Bun, and Deno](references/runtimes/node.md)
- [Rust](references/runtimes/rust.md)
- [Go](references/runtimes/go.md)
- [Native binaries](references/runtimes/native-binary.md)
- [Bundled applications](references/runtimes/bundled-js-binary.md)

Read each applicable specialist guide before using that tool:

- [DAP client](references/tools/dap.md)
- [Ghidra](references/tools/ghidra.md)
- [pwndbg](references/tools/pwndbg.md)
- [pwntools](references/tools/pwntools.md)
- [Frida](references/tools/frida.md)

## Safety and authorization

Obtain explicit user authorization before any action that is privileged, system-wide, network-intercepting, binary-modifying, or reverse-engineering. State the target, scope, risk, artifacts, and rollback first. Never disable platform security, alter global proxy or trust settings, inject into processes, patch binaries, modify kernel settings, inspect third-party code, or intercept traffic without that authorization. Prefer process-local, read-only, and source-level alternatives. Do not extract credentials or unrelated private data. Work only on systems and binaries the user is authorized to inspect.

Shell commands in these references are OS-specific examples, not universal instructions. Confirm tool availability and flags. On an unsupported runtime, use the generic loop below with the runtime's native debugger, profiler, logs, or tracing facility.

## Phase loop

1. Read [environment and journal setup](references/methodology/00-setup.md). Map the actual runtime, launcher, symbols, maps, ports, configuration, watchers, and existing reproduction.
2. Create one temporary journal. Record artifacts before creating them and include exact rollback actions.
3. For intermittent failures, run [flaky triage](references/methodology/03-flaky-triage.md) before forming hypotheses.
4. Read [investigation](references/methodology/02-investigate.md). Write at least three orthogonal hypotheses with distinguishing observations.
5. Investigate in parallel when the host supports isolated workers. One hypothesis per worker. Otherwise investigate sequentially without weakening the evidence standard.
6. After two failed rounds, use [independent reframing](references/methodology/04-independent-review.md). If independent reviewers are unavailable, perform the three framings yourself and explicitly record that they were not independent.
7. Escalate only under [the decision rules](references/methodology/05-escalate.md).
8. Confirm causality using a reversible toggle, then follow [the failing-first fix workflow](references/methodology/06-fix.md).
9. Exercise the exact user-visible path using [real-surface QA](references/methodology/08-qa.md).
10. Follow [cleanup and final gates](references/methodology/09-cleanup.md).

When the real operation cannot run, use [partial runtime evidence](references/methodology/partial-runtime-evidence.md) and label any remaining uncertainty.

## Non-negotiable invariants

- A hypothesis without an observed value is a guess. Do not fix guesses.
- Journal every temporary edit, process, port, fixture, environment override, trace, and debugger project before creating it.
- Keep inspection output bounded and targeted.
- Re-observe state immediately before mutating a live debug session.
- Confirm the cause only when toggling it toggles the failure and reverting restores the failure.
- Capture a failing owner test or regression test before the production fix; verify the same case turns green afterward.
- Do not stop at compilation or unit tests. Use the real CLI, API, worker, service, library, or binary path.
- Remove all temporary instrumentation and artifacts, then run the repository's full relevant gates.
- Do not claim independent review when the host supplied no independent reviewer.
