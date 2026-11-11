# Phases 9 and 10: Cleanup and Final Verification

Walk the journal top to bottom. Restore each artifact using its recorded rollback and mark it complete only after the operation succeeds. Stop processes you started, close debugger and browser sessions, free ports, remove session-specific fixtures and traces, restore environment variables, trust settings, proxies, kernel settings, and binary bytes, and remove temporary instrumentation without disturbing pre-existing user work.

Commands in runtime and tool guides are examples. Select processes and files by the exact identities recorded in the journal; never use a broad kill or recursive delete against an uncertain path.

Inspect repository status and diff using its version-control system. The remaining changes must be only the fix, its regression test, and any justified durable observability. Scan for breakpoints, debug prints, temporary markers, commented-out trials, generated traces, unrelated formatting, and extracted proprietary material.

Remove the journal only after cleanup is complete. If the journal cannot be removed, report its path and reason.

## Final evidence gates

1. **Red to green:** the same test failed before the fix and passed after it.
2. **Relevant suite:** the full affected suite passed.
3. **Real-surface QA:** the original scenario now produces the correct observable result.
4. **Artifact cleanup:** repository and environment contain no debugging residue beyond the intentional fix.

The final report states the causal mechanism, changed location, regression proof, QA scenario and observation, final gate results, and any unresolved follow-up. Do not claim a gate without evidence.
