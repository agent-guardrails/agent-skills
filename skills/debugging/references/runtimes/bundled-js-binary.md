# Bundled and Embedded-Source Applications

Use for authorized analysis of Bun or Node single executables, Deno compile output, `pkg`, `nexe`, Electron, Tauri frontends, and PyInstaller. These contain a runtime plus recoverable high-level code; decompiling the runtime usually wastes time.

## Fingerprint first

Use bounded marker searches and packaging layout to distinguish formats:

- Bun: Bun package and bundle markers; usually plaintext JavaScript.
- Node single executable: `NODE_SEA_BLOB` and an activated fuse; payload may be plaintext, V8 code cache, or snapshot.
- `pkg` or `nexe`: bootstrap and payload markers; plaintext or cached data.
- Deno: eszip archive, requiring an eszip parser.
- Electron: usually a separate `app.asar` archive.
- PyInstaller: compressed Python bytecode, requiring an archive extractor and compatible decompiler.
- Tauri: extract the JavaScript frontend here; analyze Rust commands as native code.

## Workflow

1. Identify bundler and version.
2. Locate and validate the bundle or archive.
3. Extract it to a journaled private temporary directory without executing untrusted code.
4. Analyze recovered source with syntax-aware tools, not lossy string dumps.
5. Verify findings at runtime with supported inspector, application logs, or [partial evidence](../methodology/partial-runtime-evidence.md).
6. Remove all extracted proprietary material.

Node payloads with code cache, Deno eszip, and PyInstaller bytecode require format-specific tools; do not claim plaintext recovery. For Electron, validate the archive header rather than matching arbitrary bytes. For minified templates, use a parser that understands escapes, nested interpolation, strings, and destructured parameters.

Bun inspector flags and verbose-fetch logging can expose runtime behavior. Node-family bundles may support `--inspect`; Electron has separate main and renderer surfaces. Confirm support for the exact build rather than assuming it.

Gotchas: `strings -n N` drops short interpolations; cached binaries may not match the reported version; case-insensitive filesystems can overwrite case-variant identifiers; runtime symbols overwhelm application markers; production bundles often omit maps; extracted source may be proprietary and must not be committed or disclosed.

Escalate to native analysis only when high-level recovery fails. Cleanup extracted bundles, archives, bytecode, string dumps, parser helpers, inspector processes, and logs from their exact journaled paths.
