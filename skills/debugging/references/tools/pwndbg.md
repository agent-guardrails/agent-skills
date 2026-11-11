# pwndbg

[pwndbg](https://github.com/pwndbg/pwndbg) augments GDB with synchronized registers, stack, disassembly, backtrace, heap, and memory views. Use it on authorized native targets when GDB is appropriate; use LLDB where the platform requires it.

Core commands include `context`, `telescope`, `stack`, `vmmap`, heap and bin inspection, `search`, and standard GDB breakpoints, stepping, watchpoints, value inspection, backtraces, frames, and disassembly. `telescope <address> <count>` is useful for following bounded pointer chains.

For a crash, capture context and backtrace before restarting. For a wrong return, break at the function and inspect the return after `finish`. For corruption, narrow the object and use a hardware watchpoint to stop at the writer. For heap faults, inspect chunks and allocator bins without dumping the entire heap.

Stripped stacks need mapping against static-analysis offsets. PIE and ASLR require the runtime image base. Optimized functions may be inlined, so break on the actual emitted location. A stack-canary failure points to an earlier write, not necessarily the crash frame.

Automation can use bounded GDB batch scripts or the Python API. Journal every script, core file, server, and debugger process. Cleanup exact sessions, server ports, core dumps, and scripts.
