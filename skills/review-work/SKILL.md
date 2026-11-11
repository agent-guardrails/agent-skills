---
name: review-work
description: "Review completed implementation before handoff or release. Use for review work, review my work, review changes, QA my work, verify implementation, check my work, validate changes, or post-implementation review. Runs real-surface manual QA plus one independent evidence-driven gate reviewer."
---

# Review Work

Review completed work through exactly two lanes:

| Lane | Owner | Question |
| --- | --- | --- |
| Manual QA | The primary reviewer | Does the delivered surface work for a real user? |
| Independent gate review | Exactly one independent reviewer | Does the change meet the goal, constraints, behavior, quality, security, context, QA, and scope requirements? |

Do not add review lanes. Do not self-approve. This skill reviews completed work only. It does not publish comments or mutate code.

## Review Inputs

Collect enough evidence to let both lanes judge the final state:

- **Goal:** Original user outcome and stated success criteria.
- **Constraints:** Technical, product, compatibility, performance, security, and process rules.
- **Background:** Relevant decisions, incidents, requirements, related documentation, and prior review feedback.
- **Change set:** Changed files, diff, relevant neighboring code, and applicable tests or generated artifacts.
- **Run instructions:** How to exercise the actual delivered surface.
- **Context findings:** A short list of source, finding, and why it matters.

Use the host's available capabilities to inspect version-control history, change sets, issue trackers, documentation, dependency references, and relevant tests. Examples include a VCS diff view, repository history, issue or review search, source search, and CI reports. These examples are optional capabilities, not required commands.

Use an isolated review checkout or worktree when the host supports it and it improves safety. A dedicated worktree is not required. Never change the implementation as part of this review.

## Lane 1: Real-Surface Manual QA

The primary reviewer personally runs this lane. Do not delegate it.

1. Exercise the final delivered state through the surface a user would use.
2. Select the closest faithful channel:
    - HTTP or API: send a real request and retain the response evidence.
    - CLI or TUI: run it in an interactive terminal and retain a transcript.
    - Tests or builds: run the relevant checks and retain their output.
    - Library or SDK: run a small consumer program that imports and uses the public API.
    - Data, configuration, migration, or generated output: inspect the resulting artifact against the expected result.
3. Cover every stated success criterion, the named happy path, the riskiest edge case, and an adjacent regression risk.
4. Record a QA matrix. A row may only pass when it has an evidence pointer.

| # | Scenario | Exact action | Expected | Observed | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |

Evidence may be a local path, test or build report, terminal transcript, request and response capture, generated artifact, or equivalent durable non-UI record.

If the application cannot start, or any QA row fails, stop immediately. Report **FAILED** with the failing rows. Do not launch the independent gate reviewer until the failure is fixed and the affected QA is rerun.

## Lane 2: Independent Gate Review

After manual QA passes, request exactly one independent reviewer through any host capability that can provide an independent review. Give that reviewer the goal, constraints, background, changed-file list, diff, relevant file contents or readable paths, context findings, and complete QA matrix with evidence pointers.

The reviewer must not implement fixes. It must validate claims against provided evidence or accessible artifacts, then use this checklist:

1. **Goal:** Break the goal into explicit and reasonably implied requirements. Mark each ACHIEVED, PARTIAL, or MISSED with evidence.
2. **Constraints:** List each constraint and verify compliance with specific evidence.
3. **Behavior:** Trace representative flows and relevant edge cases, including empty, boundary, malformed, concurrent, and failure cases when applicable.
4. **Quality:** Check local patterns, naming, error behavior, type safety, performance-sensitive paths, API hygiene, meaningful tests, and compatibility expectations.
5. **Security:** Check validation, injection risks, authorization, secret exposure, data exposure, dependencies, file handling, and network handling where relevant.
6. **Context:** Check that documentation, callers, related tests, history, issues, and prior decisions still agree with the change.
7. **QA evidence:** Verify each matrix row and identify uncovered success criteria or unproven claims.
8. **Scope:** Flag unnecessary work as a note unless it violates a stated constraint.

Require this output format:

```text
VERDICT: APPROVE or REJECT
CONFIDENCE: HIGH, MEDIUM, or LOW
SUMMARY: One to three sentences from the user's perspective.

GOAL BREAKDOWN
- [ACHIEVED/PARTIAL/MISSED] Requirement: evidence

CONSTRAINT COMPLIANCE
- [ACHIEVED/MISSED] Constraint: evidence

QA AUDIT
- [VERIFIED/UNPROVEN] QA row: evidence or missing proof

BLOCKING ISSUES
- Requirement, constraint, or QA row: observation, evidence pointer, exact fix

NOTES
- Non-blocking findings grouped by quality, security, or context
```

The reviewer may reject only with a specific failed goal item, violated constraint, failing QA row, or missing evidence required by a stated criterion. Style preferences and hypothetical future needs are notes, not blockers.

If the host cannot provide an independent reviewer, the reviewer cannot access enough evidence, or no verdict arrives, record the gate lane as **INCONCLUSIVE**. Never replace it with self-review or an inferred approval.

## Verdict Rules

| Manual QA | Independent gate | Final verdict |
| --- | --- | --- |
| PASS | APPROVE | **PASSED** |
| FAIL | Not run or any state | **FAILED** |
| PASS | REJECT | **FAILED** |
| PASS | INCONCLUSIVE or unavailable | **INCONCLUSIVE** |

A **PASSED** verdict always requires both passing manual QA evidence and an independent APPROVE verdict.

## Final Report

Report the result in this form:

```markdown
# Review Work Final Report

## Overall Verdict: PASSED / FAILED / INCONCLUSIVE

| Lane | Verdict | Confidence | Evidence |
| --- | --- | --- | --- |
| Manual QA | PASS / FAIL | N/A | QA matrix artifacts |
| Independent gate review | APPROVE / REJECT / INCONCLUSIVE | HIGH / MEDIUM / LOW / N/A | Review report or reason unavailable |

## QA Matrix
[Complete evidence-backed matrix]

## Blocking Issues
[Failing QA rows first, then gate-review blockers, deduplicated and ordered by fix priority]

## Key Findings
[Concise findings across behavior, quality, security, context, and scope]

## Recommendations
[For FAILED: exact fixes in priority order]
[For PASSED: concise non-blocking notes]
```

Keep PASSED reports short. For FAILED or INCONCLUSIVE reports, state precisely which lane prevented approval and what evidence is missing or failed.
