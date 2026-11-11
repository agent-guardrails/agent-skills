# Phases 6 and 7: Causal Confirmation and Failing-First Fix

## Confirm the cause

Call a cause confirmed only when:

1. A captured runtime value exactly matches the hypothesis prediction.
2. The same reproduction yields the observation again.
3. A reversible change to the suspected cause removes the failure, and reverting that change restores it.

The toggle may be a debugger assignment, process-local environment override, temporary source edit, synchronization primitive, or equivalent narrow intervention. Journal it first. Binary modification or process injection requires explicit authorization. If a safe toggle cannot be constructed, run another evidence round.

Record the mechanism as a causal chain from input through state to symptom, the evidence location, the before/after/reverted outputs, and expected fix scope.

## Lock the fix

1. Find the strongest existing owner test. If it already fails for the bug, use it. If it covers the path, extend it. Otherwise add one focused regression.
2. Run the test before changing production code. Confirm it fails for the reported mechanism and record bounded output.
3. Apply the smallest production change that fully fixes that mechanism.
4. Run the same test and confirm it passes.
5. Refactor only after green and only within the fix's scope.
6. Run the full affected suite.

Avoid speculative checks, adjacent refactors, new configuration, and abstractions not required by the confirmed mechanism. If diagnosis took extra rounds solely because an important decision was invisible, add durable observability only when a named ongoing consumer exists and the project already has an established logging practice. Temporary diagnostics remain artifacts and must be removed.

Finally, prove the regression test is meaningful: without the fix it fails; with the fix it passes.
