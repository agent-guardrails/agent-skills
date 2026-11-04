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

function session({ noAnswer = false } = {}) {
  const child = spawn(process.execPath, [client], {
    cwd: directory,
    env: { ...process.env, DAP_TIMEOUT_MS: noAnswer ? "300" : "5000", ...(noAnswer ? { DAP_FIXTURE_NO_ANSWER: "1" } : {}) },
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
  const timeoutSession = session({ noAnswer: true });
  await until(timeoutSession, (output) => output.includes("ERR: timeout"));
});
