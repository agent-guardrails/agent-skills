# Phases 2 and 3: Hypotheses and Investigation

## Form at least three orthogonal hypotheses

Span different cause classes: user logic, library behavior, environment or configuration, timing or concurrency, hidden side effects, swallowed errors, build-versus-runtime mismatch, or binary-level control flow. Variants of one handler bug count as one hypothesis.

For each, record:

1. A one-sentence claim.
2. The exact runtime value that would confirm or refute it and where to observe that value.
3. The likely fix in a few words.

Collapse hypotheses with identical distinguishing evidence and replace them with a genuinely different cause class.

## Investigate

If the host can run isolated parallel workers, assign one hypothesis to each worker and give every worker the complete hypothesis list. Useful roles are runtime-state inspection, log and timing analysis, reproduction minimization, and causal correlation. Workers report verbatim observations and do not edit source unless the lead explicitly coordinates it. The lead alone maintains the journal and synthesizes evidence.

If parallel workers are unavailable, investigate sequentially. Do not lower the number or orthogonality of hypotheses. Do not claim parallel or independent work that did not occur.

Before continuing, stepping, evaluating a side-effecting expression, changing a breakpoint, or terminating, re-observe thread state and stop reason. A stopped state expires as soon as the debuggee can move.

| Failure | Likely cause | Recovery |
|---|---|---|
| Adapter fails to start | Missing or wrong executable | Verify installation and invocation |
| Breakpoint remains unverified | Path mismatch, optimization, or missing symbols | Check resolved source and debug build |
| Attach refused | Permissions, platform policy, or wrong PID | Correct environment or identity; seek authorization if privilege is required |
| No expected stop | Running process, unreachable line, or inadequate wait | Pause and inspect threads |
| Unexpected termination | Crash or exit | Capture exit evidence before restart |

Record each observation as:

```markdown
### <timestamp>: <query>
- Source: <file:line, log, command, address>
- Value: `<verbatim bounded value>`
- Interpretation: <one sentence>
- Confirms/refutes: H<n>
```

A round ends after every hypothesis has evidence or available evidence sources are exhausted. An inconclusive round counts as failed. After two consecutive failed rounds, stop and use [independent reframing](04-independent-review.md).
