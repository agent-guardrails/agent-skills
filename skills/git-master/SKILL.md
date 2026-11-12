---
name: git-master
description: Use for Git status inspection, atomic commits, rebase, squash, fixup, blame, bisect, reflog recovery, and history questions; requires status-first evidence and explicit authorization for mutations.
---

# Git Master

Handle Git work conservatively. Establish repository state before drawing conclusions, keep unrelated work untouched, and never turn an investigative request into a mutation.

## Mode and authorization gate

Classify the request before running commands:

- `STATUS`: inspect the branch, worktree, index, remotes, or divergence without changing anything.
- `COMMIT`: select, stage, and commit the changes the user authorized.
- `REBASE`: rebase, squash, fix up, reorder, split, or otherwise rewrite history.
- `HISTORY`: answer when, where, who, why, or which commit changed something.
- `RECOVERY`: diagnose and recover from an interrupted or mistaken Git operation.

Treat each mutation as a separate authorization boundary. Authorization to inspect does not authorize staging. Authorization to commit does not authorize rebasing or pushing. Authorization to rebase does not authorize a force-push. Do not run `commit`, `rebase`, `reset`, `restore`, `checkout` that overwrites paths, `clean`, `stash`, `stash pop`, `bisect`, branch deletion, push, or force-push unless the user explicitly requested that operation or approved the stated recovery plan.

If a request is read-only, report the evidence and stop. Never bypass hooks, signatures, branch protection, or repository policy unless the user explicitly requests it and the consequences are understood.

## Status-first evidence

Before any mutation, inspect enough state to answer these questions:

1. Which repository and worktree are active?
2. Which branch or detached commit is checked out?
3. What is staged, unstaged, untracked, conflicted, or ignored?
4. Which upstream, remote, and base branch apply, if any?
5. Which commits are local, published, or shared?
6. Is another Git operation already in progress?

Use bounded, independent checks appropriate to the repository. Typical read-only commands include:

```bash
git status --short --branch
git diff --stat
git diff --staged --stat
git branch --show-current
git log -30 --oneline
git log -30 --pretty=format:%s
git remote -v
git rev-parse --abbrev-ref @{upstream}
```

Inspect full diffs before staging or rewriting. Missing remotes, upstreams, conventional base names, or network access are valid states; report them as unknown rather than guessing. Derive the relevant remote and base from repository configuration or user intent instead of assuming a hosting provider or a branch name.

## Commit workflow

Commit only the requested changes and preserve unrelated dirty work.

1. Read recent subjects and detect the repository's message language, casing, and style. Do not impose Conventional Commits unless recent history or repository policy uses them.
2. Inspect the full staged and unstaged diffs, including untracked files that may belong to the requested change.
3. Group changes by behavior, module, dependency, and independent revertability. Keep an implementation with its direct tests and required generated output.
4. Prefer separate commits for unrelated concerns. A single commit is correct when the files form one coherent, independently reviewable change; do not use file-count formulas.
5. Stage only the intended paths or hunks. Never sweep unrelated files into a broad add.
6. Before each commit, inspect the staged diff and confirm that it contains the complete atomic change and nothing else.
7. Run the repository's relevant checks before or immediately after the commit, according to local policy. Do not suppress failing hooks or tests.
8. After each commit, inspect its subject and patch, then report the commit identifier and any remaining changes.

Split features, independent refactors, configuration, documentation, and test-only work when each can stand alone. Combine files when separating them would break the build, invalidate a migration, omit required generated output, or detach a direct regression test from its fix.

## Rebase and history-rewrite workflow

History rewriting can disrupt collaborators. State the commits and target base before starting.

- Do not rewrite a protected, default, release, or shared branch unless the user explicitly names that exact operation and confirms the impact.
- Determine whether affected commits are published. If that cannot be established, say so and treat them as potentially shared.
- Account for a dirty worktree before rebasing. Ask before creating or applying a stash; do not use automatic stashing as an invisible side effect.
- Record a recovery point before a complex rewrite when repository policy allows it. Explain whether that is an existing reflog entry, an untouched worktree, or an explicitly authorized backup branch or tag.
- For fixups, prefer `git commit --fixup=<commit>` and `git rebase -i --autosquash <base>` when they match the user's intent.
- Resolve conflicts by reading the base, incoming change, current change, and surrounding intent. Never select `ours` or `theirs` blindly.
- During a paused rebase, inspect `git status` and the remaining todo before continuing. Run relevant tests after conflict resolution and after the rewrite completes.
- If the rebase is wrong or its intent becomes unclear, stop and use `git rebase --abort` before attempting a different strategy.

After rewriting, show the new range from base to `HEAD`, verify the worktree state, and compare the resulting tree or patch with the pre-rewrite intent. Do not push unless separately authorized.

### Publishing rewritten history

When rewritten commits replace published commits:

1. Explain that a non-fast-forward update is required and identify the remote branch.
2. Re-fetch or otherwise confirm the current remote tip immediately before pushing.
3. Obtain explicit authorization for the force-push.
4. Use `--force-with-lease`, never plain `--force`. Prefer an explicit expected remote object when supported, such as `--force-with-lease=<remote-branch-ref>:<expected-object>`, to avoid overwriting concurrent work.
5. Report the remote result and the final local-versus-remote state.

If the lease fails, stop. Fetch and reassess; do not weaken the lease or retry with plain force.

## History archaeology

Choose the tool that matches the question:

- `git log -S "text" -- <path>` finds commits where the count of an exact string changed.
- `git log -G "regex" -- <path>` finds commits whose diff matches a pattern.
- `git blame -L <start>,<end> -C -w -- <path>` attributes lines while accounting for moved code and whitespace-only changes.
- `git log --follow -- <path>` follows one file across renames.
- `git show <commit> -- <path>` inspects the candidate commit and relevant patch.
- `git log --all --full-history -- <path>` searches history for a removed path.
- `git reflog` explains recent local reference movement and provides recovery candidates.
- `git bisect` identifies the first bad commit when a deterministic pass/fail check and known good and bad bounds exist.

Pickaxe, regex log, blame, and reflog inspection are read-only. `git bisect` changes the checked-out commit, so require explicit authorization, begin from a clean or deliberately preserved worktree, record the starting point, and always finish with `git bisect reset`.

Corroborate archaeology findings. A blame result identifies the last line-level change, not necessarily the original author or cause. A matching commit subject is not proof; inspect its patch and surrounding history. Report the exact command, commit identifier, subject, path, and relevant diff or line context. State what remains uncertain.

## Recovery

Prefer operation-specific, reversible recovery:

- Rebase in progress: inspect status, then use `git rebase --abort` when abandoning it.
- Merge in progress: inspect status, then use `git merge --abort` when abandoning it.
- Cherry-pick or revert in progress: inspect status, then use the operation's `--abort` form.
- Mistaken local reference movement: inspect `git reflog`, identify the known-good object, and explain the proposed restoration before mutating anything.
- Lost-looking commit: search reflogs and reachable history before considering object-database recovery.

Never use `reset --hard`, destructive checkout or restore, `clean`, reflog expiry, garbage collection, or branch deletion as a first response. Before any destructive recovery, show what would be lost, preserve recoverable work when authorized, and obtain explicit approval for the exact command. Stop after repeated uncertainty rather than compounding damage.

## Completion report

Finish every mode with evidence:

- Mode and user-authorized operations performed.
- Repository, branch, upstream, and worktree state, including unknowns.
- Commits created or rewritten, with identifiers and subjects.
- Verification commands and outcomes.
- Remaining uncommitted, conflicted, unpublished, or recovery-relevant state.
- Any next action that still requires separate authorization.

This skill is a modified derivative. Licensing and exact upstream provenance are recorded in [LICENSE.md](LICENSE.md) and [NOTICE.md](NOTICE.md).
