# DAP Client

The bundled [DAP client](../scripts/dap.mjs) drives a debugger's structured Debug Adapter Protocol instead of scraping a human REPL. It has no dependencies and targets Node 22.

Run `node references/scripts/dap.mjs` as a persistent process. Send one command per stdin line and consume bounded stdout. Execution control emits a `STOP:` line; subscribe to that event rather than polling.

Commands:

- `launch <adapter> <program> [args...]`
- `attach 127.0.0.1:<port>` or `attach [::1]:<port>`
- `break <file>:<line>` and `rmbreak <file>:<line>`
- `continue`, `step`, `next`, `stepin`, `stepout`, `pause`
- `stack [limit]`, `scopes`, `vars <ref>`, `eval <expr>`, `threads`, `sessions`
- `terminate`, `quit`

Tables are TSV, capped at 100 rows and 32 KiB. Truncation is explicit. Every adapter-controlled output field is capped at 4 KiB after escaping, without splitting a UTF-8 code point. Tabs, CR, LF, ESC, DEL, and all C0/C1 control characters are rendered as visible ASCII escapes. TSV column counts therefore remain stable, and `STOP:` and `EVAL` each occupy exactly one physical output line. `DAP_DEBUG=1` applies the same control-character escaping to bounded protocol diagnostics on stderr.

DAP framing is fail-closed. A header section, including its terminating `CRLF CRLF`, may contain at most 8 KiB; a body declared by `Content-Length` may contain at most 1 MiB; and the parser retains at most 2 MiB of input while processing a chunk. Each frame must contain exactly one syntactically valid decimal `Content-Length` header and valid JSON. A missing, malformed, duplicate, or oversized length, an incomplete oversized header, an oversized retained buffer, or malformed JSON emits exactly one `ERR: malformed-frame`, rejects pending work, and immediately destroys the adapter transport. For a spawned adapter, teardown synchronously destroys the stdin, stdout, and stderr pipes before sending the termination signal, so an adapter that ignores `SIGTERM` cannot continue transport output or stderr work. Later close/error events do not emit a second error for that malformed frame.

TCP attach is restricted to numeric loopback endpoints: `127.0.0.1:<port>` and `[::1]:<port>`, where the decimal port is 1 through 65535. Hostnames such as `localhost`, alternate IPv4 loopback addresses, mapped IPv6 addresses, private or routable addresses, malformed endpoints, and invalid ports are rejected as invalid arguments. This endpoint recognition does not reinterpret Windows executable paths as TCP endpoints. There is no non-loopback opt-in.

Launched adapter stderr is piped and continuously drained rather than inherited or relayed. At most its newest 32 KiB is retained internally, so an adapter cannot flood client stderr or grow an unbounded stderr buffer. Requests time out after 15 seconds unless `DAP_TIMEOUT_MS` is set. Errors are classified as invalid arguments, no session, no frame, adapter failure, unverified breakpoint, timeout, termination, malformed frame, or adapter error.

Typical adapters are debugpy for Python, Delve DAP for Go, `lldb-dap` or CodeLLDB for native and Rust, JS debug adapters for Node, and runtime-specific adapters for .NET, Ruby, Kotlin, PHP, shell, Dart, and Elixir. Verify the installed adapter's launch shape; do not fall back to text scraping merely because an adapter is absent.

The client sends `launch` before waiting for `initialized`, then sends `configurationDone` without first waiting for the launch response. This supports adapters that defer the launch response until configuration is complete. `READY: launch` is emitted only after both requests succeed; a failure or timeout emits `ERR:` and never emits READY.

`scopes` and `eval` resolve the current top frame through `stackTrace`; cached frames are discarded whenever the adapter reports a new stop. If the adapter returns no usable frame, the command emits `ERR: no-frame` instead of guessing a frame ID. Variable references are session-scoped; run `scopes` immediately before `vars`.

Design inspiration: the structured debug surface in [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi). This portable implementation is not dependent on that project.

Test with `node --test references/scripts/dap.test.mjs`. Cleanup by terminating the debuggee, quitting the client, and removing journaled wrapper scripts.
