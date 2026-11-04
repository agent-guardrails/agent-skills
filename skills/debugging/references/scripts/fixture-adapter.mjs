#!/usr/bin/env node
import { argv, env, stdin, stdout } from "node:process";

let sequence = 1;
let buffer = Buffer.alloc(0);
const noAnswer = argv.includes("--no-answer") || env.DAP_FIXTURE_NO_ANSWER === "1";

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

function handle(request) {
  if (noAnswer && request.command === "initialize") return;
  switch (request.command) {
    case "initialize":
      response(request, { supportsConfigurationDoneRequest: true, supportsEvaluateForHovers: true });
      event("initialized");
      break;
    case "setBreakpoints": {
      const requested = request.arguments?.breakpoints ?? [];
      response(request, { breakpoints: requested.map((breakpoint, index) => ({ id: index + 1, verified: !request.arguments?.source?.path?.includes("unverified"), line: breakpoint.line, column: breakpoint.column ?? 1 })) });
      break;
    }
    case "configurationDone":
    case "launch":
      response(request);
      break;
    case "continue":
      response(request, { allThreadsContinued: true });
      event("stopped", { reason: "breakpoint", threadId: 1, allThreadsStopped: true });
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
      response(request, { threads: [{ id: 1, name: "main" }] });
      break;
    case "stackTrace":
      response(request, { stackFrames: [{ id: 42, name: "main", source: { path: "/tmp/program.py" }, line: 12, column: 3 }] });
      break;
    case "scopes":
      response(request, { scopes: [{ name: "Locals", variablesReference: 7, expensive: false }] });
      break;
    case "variables":
      response(request, { variables: Array.from({ length: 250 }, (_, index) => ({ name: `v${index + 1}`, value: request.arguments?.variablesReference === 8 ? `${index + 1} ${"x".repeat(500)}` : String(index + 1), variablesReference: 0 })) });
      break;
    case "evaluate":
      response(request, { result: "42", type: "int", variablesReference: 0 });
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
