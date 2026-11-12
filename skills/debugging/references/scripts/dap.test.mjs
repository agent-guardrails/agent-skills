import assert from "node:assert/strict";
// allow: SIZE_OK - one focused integration suite exercises the portable client and its fixture together.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { DapFrameParser, MAX_FIELD_BYTES, MAX_FRAME_BYTES, MAX_HEADER_BYTES, MAX_RETAINED_BYTES, MAX_STDERR_BYTES, isTcpAdapterSpec, renderAdapterField } from "./dap.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const client = join(directory, "dap.mjs");
const fixture = join(directory, "fixture-adapter.mjs");
const children = new Set();

afterEach(() => {
  for (const child of children) child.kill();
  children.clear();
});

function frame(message) {
  const body = Buffer.from(JSON.stringify(message));
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

function session({ fixtureMode = "success", timeoutMs = 5_000, frameId = 73, fixtureStateFile } = {}) {
  const child = spawn(process.execPath, [client], {
    cwd: directory,
    env: { ...process.env, DAP_TIMEOUT_MS: String(timeoutMs), DAP_FIXTURE_MODE: fixtureMode, DAP_FIXTURE_FRAME_ID: String(frameId), ...(fixtureStateFile ? { DAP_FIXTURE_STATE_FILE: fixtureStateFile } : {}) },
  });
  children.add(child);
  let output = "";
  let errorOutput = "";
  child.stdout.on("data", (data) => {
    output += data.toString();
  });
  child.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });
  const command = (value) => child.stdin.write(`${value}\n`);
  command(`launch ${fixture} /tmp/program.py`);
  return { child, command, errorOutput: () => errorOutput, output: () => output, state: () => fixtureStateFile && existsSync(fixtureStateFile) ? readFileSync(fixtureStateFile, "utf8") : "" };
}

async function until(currentSession, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!predicate(currentSession.output()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(predicate(currentSession.output()), true, currentSession.output());
}

async function assertLaunchFailure(fixtureMode, expectedError) {
  const currentSession = session({ fixtureMode, timeoutMs: 1_000 });
  await until(currentSession, (output) => output.includes(`ERR: ${expectedError}`) || output.includes("READY: launch"), 6_000);
  assert.match(currentSession.output(), new RegExp(`ERR: ${expectedError}`));
  assert.doesNotMatch(currentSession.output(), /READY: launch/);
}

test("accepts only numeric loopback TCP adapter specifications", () => {
  for (const specification of ["127.0.0.1:1", "127.0.0.1:5678", "127.0.0.1:65535", "[::1]:1", "[::1]:65535"]) {
    assert.equal(isTcpAdapterSpec(specification), true, specification);
  }
  for (const specification of ["localhost:5678", "127.0.0.2:5678", "0.0.0.0:5678", "10.0.0.1:5678", "192.168.1.2:5678", "8.8.8.8:5678", "::1:5678", "[::ffff:127.0.0.1]:5678", "127.0.0.1:0", "127.0.0.1:65536", "127.0.0.1:-1", "127.0.0.1:1.5", "127.0.0.1:", "C:\\workspace\\fixture-adapter.mjs"]) {
    assert.equal(isTcpAdapterSpec(specification), false, specification);
  }
});

describe("DAP framing", () => {
  test("parses multiple and split frames", () => {
    const parser = new DapFrameParser();
    const first = frame({ type: "event", event: "one" });
    const second = frame({ type: "event", event: "two", body: { ok: true } });
    assert.deepEqual(parser.push(Buffer.concat([first, second])), [{ type: "event", event: "one" }, { type: "event", event: "two", body: { ok: true } }]);
    const third = frame({ type: "response", seq: 3 });
    assert.deepEqual(parser.push(third.subarray(0, 9)), []);
    assert.deepEqual(parser.push(third.subarray(9, 17)), []);
    assert.deepEqual(parser.push(third.subarray(17)), [{ type: "response", seq: 3 }]);
  });

  test("rejects malformed frames", () => {
    const parser = new DapFrameParser();
    assert.throws(() => parser.push(Buffer.from("Bad: header\r\n\r\n{}")), /malformed-frame/);
  });

  test("accepts the framing limits", () => {
    const parser = new DapFrameParser();
    const body = Buffer.from(JSON.stringify({ value: "x".repeat(MAX_FRAME_BYTES - 12) }));
    assert.equal(body.length, MAX_FRAME_BYTES);
    assert.deepEqual(parser.push(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body])), [{ value: `x`.repeat(MAX_FRAME_BYTES - 12) }]);

    const headerPrefix = "Content-Length: 2\r\nX-Padding: ";
    const padding = "x".repeat(MAX_HEADER_BYTES - 4 - Buffer.byteLength(headerPrefix));
    assert.deepEqual(parser.push(Buffer.from(`${headerPrefix}${padding}\r\n\r\n{}`)), [{}]);
  });

  test("rejects oversized headers, frames, and retained input", () => {
    assert.throws(() => new DapFrameParser().push(Buffer.alloc(MAX_HEADER_BYTES + 1, "x")), /malformed-frame/);
    assert.throws(() => new DapFrameParser().push(Buffer.from(`Content-Length: ${MAX_FRAME_BYTES + 1}\r\n\r\n`)), /malformed-frame/);
    const retainedParser = new DapFrameParser();
    retainedParser.buffer = Buffer.alloc(MAX_RETAINED_BYTES);
    assert.throws(() => retainedParser.push(Buffer.from("x")), /malformed-frame/);
  });

  test("rejects missing, malformed, and duplicate Content-Length headers", () => {
    for (const input of ["Other: 2\r\n\r\n{}", "Content-Length: nope\r\n\r\n{}", "Content-Length: -1\r\n\r\n{}", "Content-Length: 2.0\r\n\r\n{}", "Content-Length: 2x\r\n\r\n{}", "Content-Length: 2\r\ncontent-length: 2\r\n\r\n{}"]) {
      assert.throws(() => new DapFrameParser().push(Buffer.from(input)), /malformed-frame/, input);
    }
  });

  test("processes a large chunk without retaining more than the buffer cap", () => {
    const parser = new DapFrameParser();
    const message = { value: "x".repeat(700_000) };
    const input = Buffer.concat([frame(message), frame(message), frame(message)]);
    assert.ok(input.length > MAX_RETAINED_BYTES);
    assert.equal(parser.push(input).length, 3);
  });

  test("stays failed after malformed input", () => {
    const parser = new DapFrameParser();
    assert.throws(() => parser.push(Buffer.from("Bad: header\r\n\r\n{}")), /malformed-frame/);
    assert.throws(() => parser.push(frame({ type: "event", event: "later" })), /malformed-frame/);
  });
});

describe("adapter field rendering", () => {
  test("escapes record separators and terminal controls", () => {
    assert.equal(renderAdapterField("a\tb\r\n\u001b\u007f\u0000\u001f\u0085z"), "a\\tb\\r\\n\\x1b\\x7f\\x00\\x1f\\x85z");
  });

  test("caps fields at complete UTF-8 code points", () => {
    const rendered = renderAdapterField("😀".repeat(MAX_FIELD_BYTES));
    assert.equal(Buffer.byteLength(rendered), MAX_FIELD_BYTES);
    assert.equal(rendered, "😀".repeat(MAX_FIELD_BYTES / 4));
    assert.equal(renderAdapterField("x".repeat(MAX_FIELD_BYTES + 1)), "x".repeat(MAX_FIELD_BYTES));
  });
});

describe("launch readiness", () => {
  test("supports a launch response deferred until configurationDone", async () => {
    const currentSession = session({ fixtureMode: "deferred-launch" });
    await until(currentSession, (output) => output.includes("READY: launch"), 2_000);
    assert.doesNotMatch(currentSession.output(), /ERR:/);
  });

  test("does not emit READY when launch fails", async () => {
    await assertLaunchFailure("failed-launch", "adapter-error");
  });

  test("does not emit READY when launch times out", async () => {
    await assertLaunchFailure("timeout-launch", "timeout");
  });

  test("does not emit READY when configurationDone fails", async () => {
    await assertLaunchFailure("failed-configuration", "adapter-error");
  });

  test("does not emit READY when configurationDone times out", async () => {
    await assertLaunchFailure("timeout-configuration", "timeout");
  });
});

describe("frame selection", () => {
  test("scopes uses the frame returned by stackTrace", async () => {
    const currentSession = session({ frameId: 731 });
    await until(currentSession, (output) => output.includes("READY: launch"));
    currentSession.command("scopes");
    await until(currentSession, (output) => output.includes("NAME\tVARIABLES_REFERENCE") || output.includes("ERR:"));
    assert.match(currentSession.output(), /Locals\t7/);
    assert.doesNotMatch(currentSession.output(), /ERR:/);
  });

  test("eval uses the frame returned by stackTrace", async () => {
    const currentSession = session({ frameId: 941 });
    await until(currentSession, (output) => output.includes("READY: launch"));
    currentSession.command("eval 6 * 7");
    await until(currentSession, (output) => output.includes("EVAL\t") || output.includes("ERR:"));
    assert.match(currentSession.output(), /EVAL\t42/);
    assert.doesNotMatch(currentSession.output(), /ERR:/);
  });

  test("scopes and eval fail clearly when stackTrace has no frame", async () => {
    const currentSession = session({ fixtureMode: "no-frames" });
    await until(currentSession, (output) => output.includes("READY: launch"));
    currentSession.command("scopes");
    currentSession.command("eval 6 * 7");
    await until(currentSession, (output) => (output.match(/ERR: no-frame/g) ?? []).length === 2 || (output.match(/ERR:/g) ?? []).length === 2);
    assert.equal((currentSession.output().match(/ERR: no-frame/g) ?? []).length, 2, currentSession.output());
    assert.doesNotMatch(currentSession.output(), /NAME\tVARIABLES_REFERENCE|EVAL\t/);
  });

  test("a stopped event invalidates the cached frame", async () => {
    const currentSession = session({ fixtureMode: "frame-changes-after-scopes", frameId: 1_111 });
    await until(currentSession, (output) => output.includes("READY: launch"));
    currentSession.command("scopes");
    await until(currentSession, (output) => output.includes("Locals\t7") || output.includes("ERR:"));
    currentSession.command("eval 6 * 7");
    await until(currentSession, (output) => output.includes("EVAL\t") || output.includes("ERR:"));
    assert.match(currentSession.output(), /EVAL\t42/);
    assert.doesNotMatch(currentSession.output(), /ERR:/);
  });
});

test("full session emits stop, stack, and capped variables", async () => {
  const currentSession = session();
  await until(currentSession, (output) => output.includes("READY: launch"));
  currentSession.command("break /tmp/program.py:12");
  await until(currentSession, (output) => output.includes("BREAK:"));
  currentSession.command("continue");
  await until(currentSession, (output) => output.includes("STOP: stopped reason=breakpoint threadId=1 main at /tmp/program.py:12:3"));
  currentSession.command("stack");
  await until(currentSession, (output) => output.includes("FRAME\t"));
  currentSession.command("vars 7");
  await until(currentSession, (output) => output.includes("TRUNCATED: rows dropped=150"));
  assert.equal((currentSession.output().match(/^v\d+\t/gm) ?? []).length, 100);
  currentSession.command("terminate");
  await until(currentSession, (output) => output.includes("EXIT:"));
});

test("byte cap reports dropped bytes", async () => {
  const currentSession = session();
  await until(currentSession, (output) => output.includes("READY: launch"));
  currentSession.command("vars 8");
  await until(currentSession, (output) => output.includes("TRUNCATED: rows dropped=") && output.includes("bytes dropped="));
});

test("classifies unverified breakpoints and timeouts", async () => {
  const currentSession = session();
  await until(currentSession, (output) => output.includes("READY: launch"));
  currentSession.command("break /tmp/unverified.py:9");
  await until(currentSession, (output) => output.includes("ERR: unverified-breakpoint"));
  const timeoutSession = session({ fixtureMode: "timeout-initialize", timeoutMs: 300 });
  await until(timeoutSession, (output) => output.includes("ERR: timeout"));
});

test("malformed adapter input emits one error and closes the transport", async () => {
  const currentSession = session({ fixtureMode: "malformed-frames", timeoutMs: 1_000 });
  await until(currentSession, (output) => output.includes("ERR: malformed-frame"));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((currentSession.output().match(/^ERR:/gm) ?? []).length, 1, currentSession.output());
  assert.equal((currentSession.output().match(/ERR: malformed-frame/g) ?? []).length, 1, currentSession.output());
  assert.doesNotMatch(currentSession.output(), /READY: launch|ERR: adapter-failed|ERR: timeout/);
});

test("malformed teardown closes every pipe before terminating a hostile adapter", async () => {
  const stateFile = join(tmpdir(), `dap-hostile-${process.pid}-${Date.now()}.log`);
  const currentSession = session({ fixtureMode: "malformed-pipe-flood", timeoutMs: 1_000, fixtureStateFile: stateFile });
  try {
    await until(currentSession, (output) => output.includes("ERR: malformed-frame"));
    await until({ output: currentSession.state }, (state) => state.includes("transport-stopped"), 2_000);
    const stoppedState = currentSession.state();
    for (const event of ["flood-attempt", "sigterm-ignored", "stdin-closed", "stdout-closed", "stderr-closed", "transport-stopped"]) assert.match(stoppedState, new RegExp(`^${event}$`, "m"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(currentSession.state(), stoppedState);
    assert.equal((currentSession.output().match(/^ERR:/gm) ?? []).length, 1, currentSession.output());
    assert.equal((currentSession.output().match(/ERR: malformed-frame/g) ?? []).length, 1, currentSession.output());
    assert.doesNotMatch(currentSession.output(), /READY: launch|ERR: adapter-failed|ERR: timeout/);
    assert.equal(currentSession.errorOutput(), "");
  } finally {
    rmSync(stateFile, { force: true });
  }
});

test("drains and bounds child stderr without relaying it", async () => {
  assert.equal(MAX_STDERR_BYTES, 32 * 1024);
  const currentSession = session({ fixtureMode: "stderr-flood" });
  await until(currentSession, (output) => output.includes("READY: launch"));
  assert.equal(currentSession.errorOutput(), "");
});

test("escapes and caps adapter-controlled output records", async () => {
  const currentSession = session({ fixtureMode: "hostile-output" });
  await until(currentSession, (output) => output.includes("READY: launch"));
  currentSession.command("continue");
  await until(currentSession, (output) => output.includes("STOP:"));
  currentSession.command("stack");
  await until(currentSession, (output) => output.includes("FRAME\tNAME"));
  currentSession.command("scopes");
  await until(currentSession, (output) => output.includes("NAME\tVARIABLES_REFERENCE"));
  currentSession.command("vars 7");
  await until(currentSession, (output) => output.includes("NAME\tVALUE"));
  currentSession.command("eval expression");
  await until(currentSession, (output) => output.includes("EVAL\t"));
  currentSession.command("threads");
  await until(currentSession, (output) => output.includes("ID\tNAME"));

  const output = currentSession.output();
  assert.match(output, /STOP: stopped reason=break\\tpoint threadId=1 frame\\tname at \/tmp\/line\\npath:12:3/);
  assert.match(output, /^73\tframe\\tname\t\/tmp\/line\\npath\t12\t3$/m);
  assert.match(output, /^scope\\rname\t7$/m);
  assert.match(output, /^var\\x1bname\tvalue\\nline$/m);
  assert.match(output, /^EVAL\tresult\\nline/m);
  assert.match(output, /^1\tthread\\x85name$/m);
  assert.doesNotMatch(output, /^point threadId=|^path\t|^line$/m);
  const evaluation = output.split("\n").find((line) => line.startsWith("EVAL\t"));
  assert.ok(evaluation);
  assert.ok(Buffer.byteLength(evaluation.slice("EVAL\t".length)) <= MAX_FIELD_BYTES);
});
