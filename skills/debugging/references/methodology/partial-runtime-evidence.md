# Partial Runtime Evidence

Use this when the real operation is blocked by missing hardware, credentials, network access, quota, or platform policy and a full mock would invalidate the claim.

Evidence strength, strongest first:

1. Pre-send or post-receive logs from the real code path.
2. Authorized process-local proxy, shim, or wire capture. Network interception, trust changes, process injection, and preload libraries require explicit authorization; avoid system-wide configuration.
3. Static extraction cross-checked against a runtime fingerprint, state file, version, user agent, or feature flag.
4. Contrastive runs through shared code paths under inputs that are executable.
5. Vendor audit history from an earlier real operation.
6. Code reading with skeptical review, explicitly marked unverified.

A complete wire capture can stand alone for request-byte claims. Behavioral claims need another signal. Otherwise prefer two independent signals from different tiers. Explain why they are independent and state the remaining gap.

If evidence is insufficient, include a prominent partial-evidence warning with the blocked operation, available signals, confidence boundary, and future verification step.

For non-debug artifact work, an optional independent reviewer can audit claims against source evidence immediately before completion. If the host has no independent reviewer, perform a documented self-audit and do not label it independent.

Cleanup includes process-local proxy variables, trace logs, shim libraries, extracted source, and any temporary certificate or trust changes. System-wide changes must be restored from the exact original state recorded before authorization and mutation.
