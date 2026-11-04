# DAP Client

The bundled [DAP client](../scripts/dap.mjs) drives a debugger's structured Debug Adapter Protocol instead of scraping a human REPL. It has no dependencies and targets Node 22.

Run `node references/scripts/dap.mjs` as a persistent process. Send one command per stdin line and consume bounded stdout. Execution control emits a `STOP:` line; subscribe to that event rather than polling.

Commands:

- `launch <adapter> <program> [args...]`
- `attach <host:port>`
- `break <file>:<line>` and `rmbreak <file>:<line>`
- `continue`, `step`, `next`, `stepin`, `stepout`, `pause`
- `stack [limit]`, `scopes`, `vars <ref>`, `eval <expr>`, `threads`, `sessions`
- `terminate`, `quit`

Tables are TSV, capped at 100 rows and 32 KiB. Truncation is explicit. Requests time out after 15 seconds unless `DAP_TIMEOUT_MS` is set. `DAP_DEBUG=1` writes bounded protocol diagnostics to stderr. Errors are classified as invalid arguments, no session, adapter failure, unverified breakpoint, timeout, termination, malformed frame, or adapter error.

Typical adapters are debugpy for Python, Delve DAP for Go, `lldb-dap` or CodeLLDB for native and Rust, JS debug adapters for Node, and runtime-specific adapters for .NET, Ruby, Kotlin, PHP, shell, Dart, and Elixir. Verify the installed adapter's launch shape; do not fall back to text scraping merely because an adapter is absent.

The client tolerates known initialization ordering and launch-response quirks in debugpy and `lldb-dap`. Variable references are session-scoped; run `scopes` immediately before `vars`.

Design inspiration: the structured debug surface in [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi). This portable implementation is not dependent on that project.

Test with `node --test references/scripts/dap.test.mjs`. Cleanup by terminating the debuggee, quitting the client, and removing journaled wrapper scripts.
