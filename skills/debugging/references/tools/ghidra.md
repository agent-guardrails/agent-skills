# Ghidra

[Ghidra](https://github.com/NationalSecurityAgency/ghidra) decompiles authorized binaries into C-like logic. Reverse engineering requires explicit authorization. Prefer source when trustworthy source exists, and use bundled-application extraction instead when the target embeds high-level code.

Create a journaled non-shared scratch project, import the binary, accept architecture detection, run default analysis, and work primarily in the Decompiler. Narrow before reading: use symbol imports and exports, string references, memory search, and cross-references.

Improve decompilation by renaming variables, assigning correct types, and correcting function signatures. Parse available C headers into data types when appropriate. Signedness, structure layout, and indirect-call recovery require manual verification.

For automated authorized analysis, use `analyzeHeadless` with a journaled project and post-script. Bound output and treat script results as hypotheses until runtime evidence confirms them.

Useful targets include unchecked length arithmetic, unsafe copy sizes, absent authorization branches, hardcoded endpoints and paths, and dynamic loading. Save bookmarks and comments when the project is retained as evidence.

Increase Java heap only when analysis requires it, and record configuration changes. Decompiler warnings and timeouts mean uncertainty, not proof. Cleanup disposable projects and headless processes; if retaining a project, disclose its path and contents.
