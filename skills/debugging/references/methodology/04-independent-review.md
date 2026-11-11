# Phase 4: Independent Reframing

After two consecutive failed rounds, stop extending the same mental model. Seek three independent reviews in parallel when the host supports independent reviewers. Supply the bug report and verbatim evidence, but not a preferred answer.

Use three orthogonal framings:

1. **Obvious but missed:** wrong process, stale artifact, typo, wrong import, wrong file, test and app running different builds, or source versus distribution mismatch. Request three ranked candidates.
2. **System boundary:** SDK behavior, middleware, proxy, transport, module load order, build-time configuration, shared-library version, ABI, or protocol negotiation. Request the exact boundary and violated contract.
3. **Invariant challenge:** list five assumptions load-bearing to current hypotheses. For each, request the smallest runtime query that falsifies it and predicted observations for both outcomes.

If no independent review capability exists, perform the three framings yourself. Mark the result as self-reframing, not independent review, and compensate with stronger falsification queries.

Synthesize by scanning for agreement across framings, turning disagreements into runtime queries, and building a new set of at least three hypotheses. Never select a conclusion merely because one reviewer ranked it first. Reset the failed-round counter and resume investigation.

After another two failed rounds, use [user decision escalation](05-escalate.md) with the complete evidence trace. Do not guess a fix.
