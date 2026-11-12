---
name: lsp-setup
description: Configure and verify a Language Server Protocol server portably. Use when diagnostics, definitions, references, symbols, or rename are unavailable; when a harness reports that no language server is configured or installed; or when a project needs an LSP selected, installed, or wired.
---

# LSP Setup

Make language intelligence work in the user's active project and harness. Use the harness's documented capabilities and configuration contract instead of assuming any product-specific tool name, server registry, or config path.

The required flow is:

**detect -> select -> install if needed -> configure if needed -> verify with a real diagnostics request**

Do not declare success from a version command, an executable lookup, valid JSON, or a server process that merely starts. Success requires a diagnostics roundtrip through the same integration the user will use.

## Safety Gates

- Read repository instructions before inspecting or changing the project.
- Keep discovery bounded to the target project. Do not scan unrelated directories.
- Prefer an existing project dependency or project-local installation over a user-wide or system-wide installation.
- Obtain explicit user approval before any global or system-wide install. Before asking, show the exact command, installation scope, expected files or directories, reason, and rollback command.
- Obtain explicit user approval before creating or editing a user-level harness config. Show the exact path and proposed change first.
- Never infer approval for a global install or user config edit from a general request to set up LSP.
- Do not run a remote bootstrap script without separately inspecting it and receiving approval for its effects.
- Do not overwrite configuration. Read it, preserve unrelated entries, and apply the smallest valid change.

## 1. Detect

### Identify the project language

1. Establish the project root from the user's target, repository instructions, or the nearest known manifest.
2. Identify languages from manifests and representative source files, not from filenames outside the project.
3. Choose one real project source file for verification. Prefer a small file that the project's normal tooling already accepts.
4. Record workspace or monorepo boundaries that the server needs in order to resolve imports and configuration.

When several languages are present, configure only the language needed for the user's task unless the user requested project-wide LSP setup.

### Discover the harness contract

Inspect the active harness's tool list, built-in help, installed documentation, or official documentation. Record:

- the operation that requests diagnostics;
- whether the harness has built-in server definitions or automatic discovery;
- the supported project-level and user-level config locations;
- the exact config schema and precedence rules;
- how server executables are resolved, including project-local dependencies;
- how the harness reports a missing, disabled, or failed server.

Treat those findings as harness-specific facts. If the harness does not document a config path or field, do not invent one. A config filename or JSON shape used by another harness is not evidence that this harness supports it.

### Inspect the current state

Check, in this order:

1. Existing project LSP or editor configuration.
2. Existing project-local dependencies and toolchain-managed servers.
3. The harness's built-in server selection for the target language.
4. Candidate server executables available to the project process.
5. The harness's diagnostic error, if any.

Record the evidence and distinguish these states:

- a suitable server is already available and only needs verification;
- a server exists but the harness cannot select or launch it;
- no suitable server is installed;
- the harness has no LSP integration, so a separate standards-compliant LSP client is required.

## 2. Select a Server

Choose the server using the following priority:

1. The project's documented or already configured server.
2. A compatible server already pinned by the project or its toolchain.
3. The active harness's documented default.
4. The language or server project's official recommendation for the detected platform and toolchain.

For competing servers, compare project compatibility, supported language features, workspace behavior, runtime requirements, and maintenance status. Do not select solely because a server appears in a host's built-in table.

Confirm the executable name, launch arguments, transport, supported file types, workspace-root requirements, and any initialization options from current authoritative documentation. Most command-line language servers use standard input/output, but never assume the transport.

## 3. Install Only When Needed

If the selected server is missing:

1. Look for a project-local installation supported by the project's existing package or environment manager.
2. Determine whether installation changes a manifest, lockfile, virtual environment, toolchain, user directory, or system directory.
3. Pin a version when the project convention or package manager supports reproducible pinning.
4. For a global or system-wide install, present the approval request required by the safety gate and wait for explicit approval.
5. Run only the approved command, then confirm that the harness process can resolve the executable. An interactive shell and the harness may have different environments.

If installation is declined, do not keep prompting or silently choose a different global installer. Report the project-local alternatives, if any, and the verification that remains blocked.

## 4. Configure the Harness

Configure only when detection proves that automatic discovery or existing configuration is insufficient.

1. Prefer the documented project-level config so the setup is reproducible and reviewable.
2. Read the current file and the harness's current schema before editing.
3. Add the smallest entry needed to select or launch the chosen server.
4. Use only fields supported by that harness. Common concepts such as command, arguments, file types, priority, environment, and initialization options may have different names or may not be configurable.
5. Preserve unrelated settings, formatting conventions, and precedence behavior.
6. Validate the resulting syntax with the harness or the format's parser.
7. If only a user-level config can express the required setup, show the exact path and proposed diff, obtain explicit approval, and edit only after approval.

Restart or reload the harness only when its documentation says configuration is not loaded dynamically. State any session impact before restarting it.

## 5. Verify With Real Diagnostics

Use the representative source file selected during detection.

1. Invoke the active harness's diagnostics operation against that file. If the harness has no LSP integration, use a standards-compliant LSP client that performs initialize, initialized, textDocument/didOpen, and textDocument/diagnostic or receives publishDiagnostics.
2. Confirm that the selected server launches and completes initialization for the real workspace.
3. Confirm that the diagnostics request receives a protocol response. Zero diagnostics is a valid result when the file is clean.
4. Capture the file, workspace root, selected server, invocation surface, and observed response or bounded error.
5. When practical, repeat the request after a normal reload to prove that configuration discovery is persistent rather than inherited from a temporary shell.

Do not introduce an error into user code merely to force a diagnostic. If a known-safe temporary fixture is necessary, create it inside the project, record it before creation, and remove it after verification.

## Troubleshooting Loop

On failure, classify the first observed boundary and fix that boundary before changing another:

| Boundary | Evidence to inspect |
| --- | --- |
| Selection | File type, server priority, disabled entries, project root |
| Resolution | Executable path as seen by the harness, project-local binary rules |
| Launch | Arguments, transport, permissions, runtime dependencies, bounded stderr |
| Initialization | Workspace root, client capabilities, initialization options |
| Document open | URI, language identifier, file encoding, file inclusion rules |
| Diagnostics | Server capability, pull versus push diagnostics, request timeout |

After every change, repeat the real diagnostics request. Do not stack speculative config changes.

## Completion Report

Report:

- detected language, project root, and representative file;
- harness contract and evidence source;
- selected server and why it matches the project;
- installation and config changes, including their scope;
- exact diagnostics action and observed result;
- any approval declined, unresolved limitation, or cleanup performed.

Call the setup complete only when the real diagnostics roundtrip succeeds. Otherwise state the failing boundary and the evidence needed to continue.
