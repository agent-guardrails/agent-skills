# Frida

[Frida](https://frida.re) instruments an authorized live process to observe arguments, return values, memory, and control flow without modifying the on-disk binary. Process injection and function replacement require explicit user authorization. Do not attach to protected, third-party, or unrelated processes without confirmed authority.

Use `frida-ps` to identify the exact target. `frida-trace` can generate handler stubs for exported functions or platform methods. For stripped internal functions, derive an image-relative offset from static analysis and add it to the runtime module base.

Core agent APIs are `Module.getExportByName`, `Module.getBaseAddress`, `Interceptor.attach`, pointer read methods, and `send()` for structured host messages. `Interceptor.replace` changes behavior and therefore requires a separate journaled causal-toggle plan and authorization.

Use a small host script to attach, load one agent, receive structured messages, and detach in a `finally` path. Hot functions can flood output: filter by arguments or caller, count calls, and emit bounded summaries.

Spawn when early initialization matters; attach when the process is already in the relevant state. Keep shared hook state simple because callbacks run on multiple threads. A target crash ends the injected agent; capture crash evidence before restarting.

Cleanup exact spawned processes, generated handler directories, agent scripts, and host scripts. Confirm that any replacement disappeared when the session detached.
