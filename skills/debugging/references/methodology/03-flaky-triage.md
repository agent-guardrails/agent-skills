# Intermittent Failure Triage

Intermittence is evidence. Before the main hypothesis loop, journal three cheap reruns:

1. Repeat the exact failing command.
2. Run the failing test or scenario alone.
3. Run the full scope on a quiet machine without concurrent suites or builds.
4. When order is plausible, run with the test runner's shuffle or seed option and record the seed.

| Signature | Dominant cause class | Next move |
|---|---|---|
| Same case fails intermittently everywhere | Real race or incorrect async test | Replace sleeps with event synchronization or an injected clock, then investigate |
| Different case fails each run, each passes alone, quiet run is green | Cross-run resource contention | Inspect shared roots, ports, containers, databases, caches, and external config |
| Same case fails only in full suite | Fixture or global-state leak | Use the recorded order to identify the leaking predecessor |
| CI-only | Resource ceiling, parallelism, clock, or platform difference | Reproduce under equivalent constraints |

Concurrent runs must not share fixed temporary roots, ports, container names, schemas, mutable dotfiles, or global caches without isolation. Use per-run directories, ephemeral ports, and unique resource names.

Never hide a flake with retries, longer sleeps, quarantine, or deletion. Fix infrastructure contention at the shared resource, order dependence at teardown, and real races at the causal seam. If not fixed, report the classification and evidence.
