# Rust Debugging

## Assess and choose the lightest tool

Record `cargo` and `rustc` versions, toolchain pin, profiles, async runtime, and available debuggers. Dev builds normally include debug information; release builds may not.

Use this order:

1. Journaled `dbg!(expr)` for a local value.
2. Existing `tracing` or logger configuration through `RUST_LOG` for flow.
3. `RUST_BACKTRACE=1` or `full` for panics.
4. `rust-gdb`, `rust-lldb`, or DAP for state and memory.
5. `tokio-console` for stuck or leaking tasks.
6. `cargo expand` for macro expansion.

For optimized-only failures, add debug information to the release profile temporarily rather than switching off the optimization that triggers the bug. Use AddressSanitizer for invalid memory, ThreadSanitizer for data races, and LeakSanitizer for leaks when the nightly toolchain and target support them. On supported Linux x86-64 systems, `rr record` and `rr replay` provide deterministic reverse execution.

Common debugger operations are break by canonical function or file line, inspect locals and arguments, print values, backtrace, switch frame, and watch a value. Pwndbg can improve native layouts.

Silent failures include `unwrap_or_default`, discarded `Result`, one-sided `if let Ok`, conversion to `Option` through `.ok()`, unawaited task panics, invisible stderr, and panicking cleanup.

Cleanup: remove temporary `dbg!`, instrumentation subscribers, and profile edits; restore `RUST_LOG`, `RUST_BACKTRACE`, and temporary compiler flags; stop only journaled debugger and console processes.
