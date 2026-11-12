---
name: ast-grep
description: "Search and rewrite code by syntax-tree shape with the optional external ast-grep CLI. Use for structural queries, codemods, or YAML rules; use text search for strings, comments, regexes, and filenames."
---

# ast-grep

Use ast-grep when the question depends on code shape rather than text bytes. It parses both the pattern and the target as code, then matches syntax-tree structure.

The `sg` executable is an optional external dependency and the boundary of this skill. It is not bundled here. Before relying on it, run `sg --version`. Some installations expose the command as `ast-grep`; if `sg --version` does not identify ast-grep, try `ast-grep --version` and substitute that executable in the examples. On Linux, `sg` may instead be the unrelated `setgroups` command. If neither executable identifies ast-grep, report the missing dependency and use another available search method or ask the user to install ast-grep. Do not install software without permission.

## Choose the right search

Use ast-grep for syntax-shaped work:

- calls, declarations, imports, classes, or control-flow constructs shaped like a pattern;
- structural rewrites and codemods;
- project YAML rules that use relational or composite AST constraints.

Use text search for literal strings, comments, filenames, license text, or regex-style byte patterns. Use a language server, compiler, or type-aware analyzer for symbol identity, inferred types, references, control flow, or data flow. ast-grep is structural, not semantic.

## Pattern model

- A pattern must be valid, complete code in the selected language.
- `$NAME` matches one AST node. A named metavariable can be reused to require the same captured text.
- `$$$ARGS` matches zero or more nodes in a list. Use a named multi-node metavariable when its capture is needed in a rewrite.
- `$_` and `$$$` are anonymous forms when no capture is needed.
- Regex syntax such as `.*`, `\w`, character classes, or alternation is not ast-grep pattern syntax. Use text search for a regex-shaped task.
- Quote shell patterns with single quotes so the shell does not expand `$NAME` or `$$$ARGS`.
- Set `--lang` when the language cannot be inferred, especially with `--stdin` or ambiguous snippets.

For example, this TypeScript pattern matches calls to `console.log` with any argument list:

```sh
sg run -p 'console.log($$$ARGS)' --lang ts src
```

## Safe workflow

1. Confirm the executable and inspect `sg run --help` when the installed version's flags are uncertain.
2. Limit the target to the smallest relevant files or directory. Respect the repository's generated, vendored, ignored, and protected paths.
3. Express the target as complete code. Test uncertain patterns against a small representative file or snippet before searching broadly.
4. Search without a rewrite first. Inspect both expected matches and nearby cases that must not match.
5. Preview every rewrite without mutation. Record the match count and affected-file count, then inspect every proposed replacement or a bounded representative set when the result is large.
6. Apply only the reviewed pattern to the reviewed scope.
7. Inspect the resulting change, run the repository's formatter and relevant tests, and report matches and files affected. Revert or repair any unintended rewrite before completion.

Never infer that zero matches means the code is absent until the pattern, language, parse result, and search scope have been checked.

## Search and rewrite

Search first:

```sh
sg run -p 'console.log($$$ARGS)' --lang ts src
```

Preview a rewrite as structured output:

```sh
sg run -p 'console.log($$$ARGS)' -r 'logger.info($$$ARGS)' --lang ts --json=compact src
```

After reviewing that preview, apply the same pattern, rewrite, language, and scope in a separate command:

```sh
sg run -p 'console.log($$$ARGS)' -r 'logger.info($$$ARGS)' --lang ts --update-all src
```

Keep preview and apply as two invocations. In the upstream workflow, `--json` and `--update-all` do not form a reliable combined write command: structured preview is one pass, mutation is another. Never add `--update-all` before reviewing the preview.

## Diagnose unexpected results

When a known construct does not match:

1. Verify that the selected language matches the file, including JSX or TSX variants.
2. Make the pattern complete. For example, a Python function pattern needs a body, and a JavaScript function pattern needs parameters and a body.
3. Reduce the case to one small source file or a snippet passed with `--stdin` and an explicit `--lang`.
4. Inspect how ast-grep parsed the pattern:

```sh
sg run -p 'console.log($$$ARGS)' --lang ts --debug-query=ast --stdin
```

5. If the pattern contains regex concepts, switch to text search instead of forcing them into AST syntax.
6. If the question depends on bindings or types rather than shape, switch to a semantic tool.

Do not blindly cycle through pattern variants. Each retry should test a specific parsing, language, or scope hypothesis.

## YAML rules

Use an inline pattern for a one-off structural query. Use a project YAML rule when the repository already has ast-grep configuration or the check needs constraints, relationships such as `inside` or `has`, reusable transforms, tests, or an autofix.

Run the project's configured rules:

```sh
sg scan src
```

Run one rule file:

```sh
sg scan -r rules/no-console.yml src
```

Treat rule fixes like command-line rewrites: scan first, inspect findings and the rule's fix, then use the installed version's documented update flag only after review. Keep reusable rules and their tests in the target repository, not in this skill package.

## Reporting

For a search, report the pattern, language, scope, match count, and affected-file count. For a rewrite, also report that a dry run was reviewed, which verification ran after applying it, and whether any files required manual correction. State clearly when ast-grep was unavailable and which fallback was used.
