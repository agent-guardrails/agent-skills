# pwntools

[pwntools](https://docs.pwntools.com/en/stable/) creates reproducible byte-level interactions with authorized local binaries and network services. Use it for crafted inputs, deterministic crash reproduction, fuzz harnesses, and security testing only within authorized scope.

The `process`, `remote`, and authorized SSH transports share send and receive methods. Always use explicit timeouts and bounded reads. Configure `context.binary` or architecture once so packing, assembly, disassembly, cyclic patterns, and ELF parsing match the target.

`ELF` resolves symbols, imports, linkage tables, and byte searches. `cyclic` and `cyclic_find` identify exact overwrite offsets. The GDB integration can launch or attach pwndbg while the script supplies deterministic input.

A regression harness should assert the observable fixed behavior, capture exit status or signal, avoid interactive mode, and clean child processes in a failure-safe path. Seed fuzzing randomness and persist only minimal reproducing inputs.

Disabling ASLR, changing kernel settings, connecting to remote services, or demonstrating exploitation requires explicit authorization and complete rollback. Prefer leaving platform protections enabled and account for randomization in the harness.

Cleanup journaled scripts, minimized inputs, crash lists, child processes, debugger sessions, and any authorized system setting changes.
