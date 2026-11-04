# Native Binary Debugging

Use only for authorized targets without trustworthy source. Obtain explicit authorization before reverse engineering, attaching to another process, elevating privileges, changing system security, injecting libraries, intercepting traffic, or modifying bytes.

## First discriminate bundled applications

`file` alone is inconclusive. A very large executable plus markers for JavaScript runtimes, Electron, Tauri, or PyInstaller indicates [bundled application analysis](bundled-js-binary.md), not native decompilation.

## Ordered workflow

1. Triage architecture, format, linkage, symbols, security properties, and bounded strings.
2. Trace system or library calls with the platform-native facility.
3. Decompile narrowed functions with [Ghidra](../tools/ghidra.md).
4. Confirm state dynamically with LLDB or [pwndbg](../tools/pwndbg.md).
5. Build a deterministic reproduction with [pwntools](../tools/pwntools.md).
6. Add a failing regression or produce an evidence-rich upstream report.

Use `strings` only for fingerprinting; minimum-length filtering silently loses short content. For exact extraction, read bounded byte ranges directly. If source is available, reproduce C/C++ memory faults with AddressSanitizer and UndefinedBehaviorSanitizer before inferring from machine code.

Linux examples include `readelf`, `nm`, `objdump`, `ldd`, `strace`, and `ltrace`. macOS examples include `otool`, `lipo`, `codesign`, `spctl`, `dyld_info`, unified logging, and LLDB. These commands are platform-specific; use the target OS equivalents elsewhere.

On macOS, platform protection can block tracing or injected libraries. Do not disable it. Prefer LLDB on authorized unsigned targets or application logs. Any system proxy, trust-store, or network interception change requires separate explicit authorization and exact state capture before mutation. Prefer a process-local proxy.

Data watchpoints stop at the writer that corrupts a narrowed address. Hardware slots are limited. Account for address randomization when mapping decompiler offsets to runtime addresses.

Fix preference: source patch and rebuild; then an authorized minimal binary patch with original bytes recorded; then an authorized process-local wrapper or shim; otherwise an upstream report with triage, reproduction, decompilation, evidence, and patch sketch.

Cleanup all trace output, core dumps, extracted strings, debugger projects, shims, modified bytes, proxy state, trust state, and processes using the journal. Never broadly delete or kill by an uncertain pattern.
