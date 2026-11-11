# Node.js, TypeScript, Bun, and Deno Debugging

## Assess

Identify the actual runtime and launcher from `package.json`, scripts, lock files, and installed binaries. Check source-map generation and debugger ports. Confirm whether TypeScript runs from source or built output.

## Important source-map failure

With `tsx`, V8 may list the TypeScript module while the `node inspect` CLI leaves file-and-line breakpoints pending forever. Reliable alternatives are a journaled `debugger;` statement, a standards-based DevTools client, or debugging built JavaScript with verified source maps.

## Launch examples

```sh
node --inspect-brk=9229 dist/index.js
node --enable-source-maps --inspect=9229 dist/index.js
node --inspect=9229 --import tsx index.ts
NODE_OPTIONS='--inspect-brk=9229' npx tsx index.ts
bun --inspect-brk src/index.ts
deno run --inspect-brk --allow-all src/main.ts
vitest --inspect-brk --no-file-parallelism
```

Bun uses WebKit Inspector Protocol, not V8 CDP. Deno and Node use V8 inspector. The Node discovery endpoint exposes structured targets; use a CDP client instead of scraping debugger text when available.

At `node inspect`, useful commands include `cont`, `next`, `step`, `out`, `pause`, `bt`, `scripts`, `sb`, `cb`, `breakpoints`, `watch`, `exec`, `repl`, and `kill`. With `tsx`, do not trust a listed pending source breakpoint as proof it can bind.

Observe runtime configuration, `process.cwd()`, `process.argv`, in-flight request state, pending promises, response status, and semantic result fields. Silent failures include empty 2xx responses, implausibly fast remote calls, zero usage, error stop reasons inside success envelopes, unhandled rejections, empty catches, discarded promises, and callbacks never scheduled.

Cleanup: remove `debugger;` and temporary logs, close inspector clients, stop only journaled processes, and verify inspector ports are free.
