# Go Debugging

## Assess

Record Go version, module, build tags, installed Delve version, race-sensitive scope, and whether profiling endpoints already exist.

Use Delve rather than plain GDB because it understands goroutines and Go values:

```sh
dlv debug ./cmd/server -- --port=8080
dlv test ./internal/handler
dlv exec ./bin/server
dlv attach <pid>
dlv dap --listen=127.0.0.1:2345
```

For accurate stepping, build a temporary debug binary with `go build -gcflags="all=-N -l"`. Useful commands include `break`, `continue`, `next`, `step`, `stepout`, `stack`, `goroutines`, `goroutine <id>`, `locals`, `args`, `print`, `vars`, and `trace`.

Run `go test -race ./...` before attaching when the failure is intermittent. For leaks and contention, inspect bounded CPU, heap, goroutine, block, and mutex profiles. Compare two goroutine profiles separated by the manifestation interval. Use `GODEBUG` scheduler or GC traces only when they distinguish a hypothesis and cap the output.

Goroutines accumulating at channel receive suggest a dead producer; `semacquire` suggests lock contention; `netpoll` suggests downstream I/O; a rising goroutine count suggests leaked ownership. Inspect every `recover()` for whether it surfaces stack and error.

Silent failures include discarded errors, bare recovery, goroutines with no error path, fixed sleeps, ignored cancellation, unchecked closed-channel reads, and zero-value decoding.

Cleanup: stop journaled Delve and profile endpoints, remove debug prints and temporary imports, release ports, and restore `GODEBUG` and compiler flags.
