import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { DapFrameParser, isTcpAdapterSpec } from "./dap.mjs";

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

function session({ fixtureMode = "success", timeoutMs = 5_000, frameId = 73 } = {}) {
  const child = spawn(process.execPath, [client], {
    cwd: directory,
    env: { ...process.env, DAP_TIMEOUT_MS: String(timeoutMs), DAP_FIXTURE_MODE: fixtureMode, DAP_FIXTURE_FRAME_ID: String(frameId) },
  });
  children.add(child);
  let output = "";
  child.stdout.on("data", (data) => {
    output += data.toString();
  });
  const command = (value) => child.stdin.write(`${value}\n`);
  command(`launch ${fixture} /tmp/program.py`);
  return { child, command, output: () => output };
}

async function until(currentSession, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!predicate(currentSession.output()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(predicate(currentSession.output()), true, currentSession.output());
}

async function assertLaunchFailure(fixtureMode, expectedError) {
  const currentSession = session({ fixtureMode, timeoutMs: 300 });
  await until(currentSession, (output) => output.includes(`ERR: ${expectedError}`) || output.includes("READY: launch"), 4_000);
  assert.match(currentSession.output(), new RegExp(`ERR: ${expectedError}`));
  assert.doesNotMatch(currentSession.output(), /READY: launch/);
}

test("treats Windows paths as executable specifications", () => {
  assert.equal(isTcpAdapterSpec("C:\\workspace\\fixture-adapter.mjs"), false);
  assert.equal(isTcpAdapterSpec("127.0.0.1:5678"), true);
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
});

describe("launch readiness", () => {
  test("supports a launch response deferred until configurationDone", async () => {
    const currentSession = session({ fixtureMode: "deferred-launch" });
    await until(currentSession, (output) => output.includes("READY: launch"), 500);
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
