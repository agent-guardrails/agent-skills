# Python Debugging

## Assess

Identify the interpreter, environment manager, test launcher, installed debugger, and async runtime. Wrapper commands change flag placement. `pytest` loads fixtures during collection, and output capture hides interactive breakpoints unless disabled.

## Attach choices

- Inline `breakpoint()` is the most reliable when source edits and restart are possible.
- `python -m pdb script.py` breaks at entry without a source edit.
- `pdb.pm()` inspects the most recent propagated exception.
- `python -m debugpy --listen 127.0.0.1:5678 --wait-for-client script.py` exposes DAP for structured automation.

Useful `pdb` commands: `l`, `ll`, `s`, `n`, `r`, `c`, `b`, `cl`, `w`, `u`, `d`, `a`, `p`, `pp`, `interact`, and `q`. Journal every breakpoint and listener.

For pytest, use `pytest --pdb -x -s path/to/test.py::test_name`; use `--trace` for entry and `--pdb-trace` for collection or fixture setup.

## Async and performance

Use `PYTHONASYNCIODEBUG=1` for timing and task failures. Inspect stored tasks and unhandled exceptions; a created task that is never awaited may fail after its owner returns. Avoid changing timing with an interactive debugger when diagnosing a hang: use bounded sampling such as `py-spy dump --pid <pid>` or a profiler such as Memray.

Silent-failure signals include broad empty exception handlers, loggers without handlers, discarded tasks, missing mapping keys returning `None`, ignored subprocess return codes, overly broad suppression, and queue-empty loops that discard work.

Cleanup: remove temporary breakpoints and imports, stop only listeners recorded in the journal, release the chosen port, and restore `PYTHONBREAKPOINT` and `PYTHONASYNCIODEBUG`.
