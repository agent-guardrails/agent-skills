#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { env, stderr, stdin, stdout } from "node:process";

let sequence = 1;
let buffer = Buffer.alloc(0);
const fixtureMode = env.DAP_FIXTURE_MODE || "success";
const configuredFrameId = Number(env.DAP_FIXTURE_FRAME_ID || "73");
const fixtureStateFile = env.DAP_FIXTURE_STATE_FILE;
let activeFrameId = configuredFrameId;
let deferredLaunch = null;
let floodTimer = null;
let terminationIgnored = false;
const closedPipes = new Set();

function recordFixtureState(event) {
  if (fixtureStateFile) appendFileSync(fixtureStateFile, `${event}\n`);
}

function stopClosedTransport() {
  if (closedPipes.size !== 3 || !terminationIgnored) return;
  clearInterval(floodTimer);
  recordFixtureState("transport-stopped");
  setImmediate(() => process.exit(0));
}

function markPipeClosed(pipe) {
  if (closedPipes.has(pipe)) return;
  closedPipes.add(pipe);
  recordFixtureState(`${pipe}-closed`);
  stopClosedTransport();
}

function attemptFlood() {
  recordFixtureState("flood-attempt");
  for (const [pipe, stream] of [["stdout", stdout], ["stderr", stderr]]) {
    try {
      stream.write(Buffer.alloc(64 * 1024, pipe === "stdout" ? "o" : "e"), (error) => {
        if (error) markPipeClosed(pipe);
      });
    } catch {
      markPipeClosed(pipe);
    }
  }
}

function startHostileFlood() {
  process.on("SIGTERM", () => {
    terminationIgnored = true;
    recordFixtureState("sigterm-ignored");
    stopClosedTransport();
  });
  stdin.on("end", () => markPipeClosed("stdin"));
  stdin.on("close", () => markPipeClosed("stdin"));
  stdout.on("error", () => markPipeClosed("stdout"));
  stdout.on("close", () => markPipeClosed("stdout"));
  stderr.on("error", () => markPipeClosed("stderr"));
  stderr.on("close", () => markPipeClosed("stderr"));
  floodTimer = setInterval(attemptFlood, 10);
}

function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  stdout.write(body);
}

function response(request, body = {}, success = true, message) {
  send({ type: "response", seq: sequence++, request_seq: request.seq, success, command: request.command, body, ...(message ? { message } : {}) });
}

function event(name, body = {}) {
  send({ type: "event", seq: sequence++, event: name, body });
}

function respondForFrame(request, body) {
  if (request.arguments?.frameId !== activeFrameId) {
    response(request, {}, false, `expected frame ${activeFrameId}`);
    return false;
  }
  response(request, body);
  return true;
}

function handle(request) {
  switch (request.command) {
    case "initialize":
      if (fixtureMode === "timeout-initialize") return;
      if (fixtureMode === "malformed-frames") {
        stdout.write("Content-Length: nope\r\n\r\n{}");
        stdout.write("Content-Length: nope\r\n\r\n{}");
        return;
      }
      if (fixtureMode === "malformed-pipe-flood") {
        startHostileFlood();
        stdout.write("Content-Length: nope\r\n\r\n{}");
        attemptFlood();
        return;
      }
      if (fixtureMode === "stderr-flood") stderr.write(Buffer.concat([Buffer.from("RAW_STDERR_MARKER\n"), Buffer.alloc(64 * 1024, "e")]));
      response(request, { supportsConfigurationDoneRequest: true, supportsEvaluateForHovers: true });
      event("initialized");
      break;
    case "setBreakpoints": {
      const requested = request.arguments?.breakpoints ?? [];
      response(request, { breakpoints: requested.map((breakpoint, index) => ({ id: index + 1, verified: !request.arguments?.source?.path?.includes("unverified"), line: breakpoint.line, column: breakpoint.column ?? 1 })) });
      break;
    }
    case "launch":
      if (fixtureMode === "deferred-launch") {
        deferredLaunch = request;
        break;
      }
      if (fixtureMode === "failed-launch") {
        response(request, {}, false, "launch failed");
        break;
      }
      if (fixtureMode === "timeout-launch") break;
      response(request);
      break;
    case "configurationDone":
      if (fixtureMode === "failed-configuration") {
        response(request, {}, false, "configuration failed");
        break;
      }
      if (fixtureMode === "timeout-configuration") break;
      response(request);
      if (deferredLaunch) {
        response(deferredLaunch);
        deferredLaunch = null;
      }
      if (!["failed-launch", "timeout-launch"].includes(fixtureMode)) event("stopped", { reason: fixtureMode === "hostile-output" ? "entry\nreason" : "entry", threadId: 1, allThreadsStopped: true });
      break;
    case "continue":
      response(request, { allThreadsContinued: true });
      event("stopped", { reason: fixtureMode === "hostile-output" ? "break\tpoint" : "breakpoint", threadId: 1, allThreadsStopped: true });
      break;
    case "next":
    case "stepIn":
    case "stepOut":
      response(request);
      event("stopped", { reason: "step", threadId: 1 });
      break;
    case "pause":
      response(request);
      event("stopped", { reason: "pause", threadId: 1 });
      break;
    case "threads":
      response(request, { threads: [{ id: 1, name: fixtureMode === "hostile-output" ? "thread\u0085name" : "main" }] });
      break;
    case "stackTrace":
      response(request, { stackFrames: fixtureMode === "no-frames" ? [] : [{ id: activeFrameId, name: fixtureMode === "hostile-output" ? "frame\tname" : "main", source: { path: fixtureMode === "hostile-output" ? "/tmp/line\npath" : "/tmp/program.py" }, line: 12, column: 3 }] });
      break;
    case "scopes":
      if (respondForFrame(request, { scopes: [{ name: fixtureMode === "hostile-output" ? "scope\rname" : "Locals", variablesReference: 7, expensive: false }] }) && fixtureMode === "frame-changes-after-scopes") {
        activeFrameId++;
        event("stopped", { reason: "breakpoint", threadId: 1, allThreadsStopped: true });
      }
      break;
    case "variables":
      response(request, { variables: fixtureMode === "hostile-output" ? [{ name: "var\u001bname", value: "value\nline", variablesReference: 0 }] : Array.from({ length: 250 }, (_, index) => ({ name: `v${index + 1}`, value: request.arguments?.variablesReference === 8 ? `${index + 1} ${"x".repeat(500)}` : String(index + 1), variablesReference: 0 })) });
      break;
    case "evaluate":
      respondForFrame(request, { result: fixtureMode === "hostile-output" ? `result\nline${"😀".repeat(2_000)}` : "42", type: "int", variablesReference: 0 });
      break;
    case "terminate":
      response(request);
      event("terminated");
      break;
    default:
      response(request, {}, false, `unsupported ${request.command}`);
  }
}

stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const marker = buffer.indexOf(Buffer.from("\r\n\r\n"));
    if (marker < 0) return;
    const match = buffer.subarray(0, marker).toString("ascii").match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.subarray(marker + 4);
      continue;
    }
    const length = Number(match[1]);
    const start = marker + 4;
    if (buffer.length < start + length) return;
    const body = buffer.subarray(start, start + length);
    buffer = buffer.subarray(start + length);
    handle(JSON.parse(body.toString("utf8")));
  }
});
