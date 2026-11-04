#!/usr/bin/env node
// allow: SIZE_OK - single-file, zero-dependency DAP REPL kept portable for direct installation.
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { argv, env, stderr, stdin, stdout } from "node:process";

export const MAX_ROWS = 100;
export const MAX_OUTPUT_BYTES = 32 * 1024;

export function isTcpAdapterSpec(spec) {
  const separator = spec.lastIndexOf(":");
  return separator > 0 && !spec.includes("/") && !spec.includes("\\") && /^\d+$/.test(spec.slice(separator + 1));
}

export class DapFrameParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    const messages = [];
    while (true) {
      const marker = this.buffer.indexOf(Buffer.from("\r\n\r\n"));
      if (marker < 0) return messages;
      const header = this.buffer.subarray(0, marker).toString("ascii");
      const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i);
      if (!match) throw new Error("malformed-frame");
      const length = Number(match[1]);
      const start = marker + 4;
      if (this.buffer.length < start + length) return messages;
      const body = this.buffer.subarray(start, start + length);
      this.buffer = this.buffer.subarray(start + length);
      try {
        messages.push(JSON.parse(body.toString("utf8")));
      } catch {
        throw new Error("malformed-frame");
      }
    }
  }
}

const timeoutMs = Number(env.DAP_TIMEOUT_MS || 15_000);
let transport = null;
let nextSequence = 1;
let initialized = false;
let terminated = false;
let currentStop = null;
let topFrame = null;
const pending = new Map();
const breakpoints = new Map();
const eventWaiters = new Map();

function line(text) {
  stdout.write(`${text}\n`);
}

function reportError(kind, detail = "") {
  line(`ERR: ${kind}${detail ? ` ${detail}` : ""}`);
}

function waitForEvent(name) {
  return new Promise((resolve) => {
    const waiters = eventWaiters.get(name) || [];
    waiters.push(resolve);
    eventWaiters.set(name, waiters);
  });
}

function emitEvent(name, value) {
  const waiters = eventWaiters.get(name) || [];
  eventWaiters.delete(name);
  for (const resolve of waiters) resolve(value);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function trace(direction, message) {
  if (env.DAP_DEBUG) stderr.write(`DAP ${direction} ${JSON.stringify(message).slice(0, 300)}\n`);
}

function send(message) {
  trace(">", message);
  const body = Buffer.from(JSON.stringify(message));
  transport.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
}

function request(commandName, requestArguments = {}) {
  if (!transport || terminated) return Promise.reject(new Error("no-session"));
  const sequence = nextSequence++;
  send({ type: "request", seq: sequence, command: commandName, arguments: requestArguments });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(sequence);
      reject(new Error("timeout"));
    }, timeoutMs);
    pending.set(sequence, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (value) => {
        clearTimeout(timer);
        reject(value);
      },
    });
  });
}

function onMessage(message) {
  trace("<", message);
  if (message.type === "response") {
    const waiter = pending.get(message.request_seq);
    if (!waiter) return;
    pending.delete(message.request_seq);
    if (message.success === false) waiter.reject(new Error("adapter-error"));
    else waiter.resolve(message);
    return;
  }
  if (message.type !== "event") return;
  if (message.event === "initialized") {
    initialized = true;
    emitEvent("initialized");
  }
  if (message.event === "stopped") {
    currentStop = message.body || {};
    emitEvent("stopped", currentStop);
  }
  if (message.event === "terminated" || message.event === "exited") {
    terminated = true;
    emitEvent("terminated");
  }
}

function connectTransport(writer, reader, closer = reader) {
  transport = { write: (chunk) => writer.write(chunk), destroy: () => closer.destroy?.() };
  const parser = new DapFrameParser();
  reader.on("data", (chunk) => {
    try {
      for (const message of parser.push(chunk)) onMessage(message);
    } catch {
      reportError("malformed-frame");
    }
  });
  reader.on("error", () => {
    if (!terminated) reportError("adapter-failed");
  });
  reader.on("close", () => {
    if (!terminated) reportError("adapter-failed");
  });
}

async function startAdapter(spec) {
  if (isTcpAdapterSpec(spec)) {
    const separator = spec.lastIndexOf(":");
    const socket = createConnection(Number(spec.slice(separator + 1)), spec.slice(0, separator));
    connectTransport(socket, socket, socket);
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    return;
  }
  const isScript = /\.(mjs|cjs|js)$/.test(spec);
  const [commandName, commandArguments] = isScript ? [process.execPath, [spec]] : [spec, []];
  const child = spawn(commandName, commandArguments, { stdio: ["pipe", "pipe", "inherit"] });
  connectTransport(child.stdin, child.stdout, child);
  child.on("error", () => reportError("adapter-failed"));
}

async function waitForStop(required = true, graceMilliseconds) {
  if (currentStop || terminated) return Boolean(currentStop);
  await Promise.race([waitForEvent("stopped"), waitForEvent("terminated"), sleep(graceMilliseconds ?? timeoutMs)]);
  if (required && !currentStop && !terminated) throw new Error("timeout");
  return Boolean(currentStop);
}

async function waitForInitialization() {
  if (initialized) return;
  await Promise.race([waitForEvent("initialized"), sleep(timeoutMs)]);
  if (!initialized) throw new Error("timeout");
}

function adapterIdFor(spec) {
  const basename = String(spec).split(/[\\/]/).pop().toLowerCase();
  if (basename.includes("debugpy") || basename.includes("python")) return "debugpy";
  if (basename.includes("lldb")) return "lldb-dap";
  if (basename.includes("dlv") || basename.includes("delve")) return "dlv";
  if (basename.includes("js-debug")) return "js-debug";
  if (basename.includes("gdb")) return "gdb";
  return "portable-dap-client";
}

function classify(error) {
  if (["timeout", "adapter-error", "no-session", "malformed-frame"].includes(error.message)) return error.message;
  return "adapter-failed";
}

async function launch(adapter, program, programArguments) {
  if (!adapter || !program) return reportError("invalid-args");
  if (transport) return reportError("adapter-error", "session already exists");
  try {
    await startAdapter(adapter);
    await request("initialize", { clientID: "portable-dap-client", adapterID: adapterIdFor(adapter), linesStartAt1: true, columnsStartAt1: true, pathFormat: "path" });
    await request("launch", { program, args: programArguments, console: "internalConsole", justMyCode: false, stopOnEntry: true }).catch(() => null);
    await waitForInitialization();
    await request("configurationDone").catch(() => null);
    await waitForStop(false, 2_000);
    line("READY: launch");
  } catch (error) {
    reportError(classify(error));
  }
}

async function snapshot() {
  if (terminated) return line("EXIT: terminated");
  try {
    const response = await request("stackTrace", { threadId: currentStop?.threadId || 1, levels: 1 });
    topFrame = response.body?.stackFrames?.[0];
    const frame = topFrame;
    if (frame) line(`STOP: stopped reason=${currentStop?.reason || "unknown"} threadId=${currentStop?.threadId || ""} ${frame.name} at ${frame.source?.path || "?"}:${frame.line || 0}:${frame.column || 0}`);
    else line(`STOP: stopped reason=${currentStop?.reason || "unknown"} threadId=${currentStop?.threadId || ""} ? at ?:0:0`);
  } catch (error) {
    reportError(classify(error));
  }
}

function boundedTable(header, rows) {
  const rendered = rows.map((row) => row.join("\t"));
  let output = `${header.join("\t")}\n`;
  let count = 0;
  for (const row of rendered.slice(0, MAX_ROWS)) {
    const candidate = `${row}\n`;
    if (Buffer.byteLength(output + candidate) > MAX_OUTPUT_BYTES) break;
    output += candidate;
    count++;
  }
  stdout.write(output);
  const droppedRows = rendered.length - count;
  const droppedBytes = Buffer.byteLength(rendered.slice(count).join("\n") + (droppedRows ? "\n" : ""));
  if (droppedRows || droppedBytes) line(`TRUNCATED: rows dropped=${droppedRows} bytes dropped=${droppedBytes}`);
}

async function handleCommand(input) {
  const parts = input.trim().split(/\s+/);
  const commandName = parts.shift();
  if (!commandName) return;
  if (commandName === "quit") {
    transport?.destroy?.();
    process.exit(0);
  }
  if (commandName === "launch") return launch(parts.shift(), parts.shift(), parts);
  if (commandName === "attach") {
    const specification = parts.shift();
    if (!specification || !isTcpAdapterSpec(specification)) return reportError("invalid-args");
    try {
      await startAdapter(specification);
      await request("initialize", { clientID: "portable-dap-client", adapterID: "debugpy", linesStartAt1: true, columnsStartAt1: true, pathFormat: "path" });
      await request("attach", { justMyCode: false });
      await waitForInitialization();
      await request("configurationDone");
      line("READY: attach");
    } catch (error) {
      reportError(classify(error));
    }
    return;
  }
  if (!transport) return reportError("no-session");
  try {
    if (commandName === "break" || commandName === "rmbreak") {
      const specification = parts[0] || "";
      const separator = specification.lastIndexOf(":");
      const file = specification.slice(0, separator);
      const lineNumber = Number(specification.slice(separator + 1));
      if (!file || !Number.isInteger(lineNumber) || lineNumber < 1) return reportError("invalid-args");
      const current = breakpoints.get(file) || [];
      const next = commandName === "break" ? [...current.filter((entry) => entry.line !== lineNumber), { line: lineNumber }] : current.filter((entry) => entry.line !== lineNumber);
      const response = await request("setBreakpoints", { source: { path: file }, breakpoints: next });
      breakpoints.set(file, next);
      if (response.body?.breakpoints?.some((entry) => entry.verified === false)) reportError("unverified-breakpoint");
      else line(`BREAK: ${file}:${lineNumber}`);
      return;
    }
    if (["continue", "step", "next", "stepin", "stepout", "pause"].includes(commandName)) {
      const dapCommand = { step: "next", stepin: "stepIn", stepout: "stepOut" }[commandName] || commandName;
      const threadId = currentStop?.threadId || 1;
      currentStop = null;
      await request(dapCommand, { threadId });
      await waitForStop();
      await snapshot();
      return;
    }
    if (commandName === "stack") {
      const response = await request("stackTrace", { threadId: currentStop?.threadId || 1, levels: Number(parts[0]) || MAX_ROWS });
      boundedTable(["FRAME", "NAME", "FILE", "LINE", "COLUMN"], (response.body?.stackFrames || []).map((frame) => [String(frame.id), frame.name, frame.source?.path || "", String(frame.line || ""), String(frame.column || "")]));
      return;
    }
    if (commandName === "scopes") {
      const response = await request("scopes", { frameId: topFrame?.id || 42 });
      boundedTable(["NAME", "VARIABLES_REFERENCE"], (response.body?.scopes || []).map((scope) => [scope.name, String(scope.variablesReference)]));
      return;
    }
    if (commandName === "vars") {
      if (!parts[0]) return reportError("invalid-args");
      const response = await request("variables", { variablesReference: Number(parts[0]) });
      boundedTable(["NAME", "VALUE"], (response.body?.variables || []).map((variable) => [variable.name, variable.value ?? ""]));
      return;
    }
    if (commandName === "eval") {
      if (!parts.length) return reportError("invalid-args");
      const response = await request("evaluate", { expression: parts.join(" "), frameId: topFrame?.id || 42 });
      line(`EVAL\t${response.body?.result || ""}`);
      return;
    }
    if (commandName === "threads") {
      const response = await request("threads");
      boundedTable(["ID", "NAME"], (response.body?.threads || []).map((thread) => [String(thread.id), thread.name]));
      return;
    }
    if (commandName === "sessions") return line("SESSION\tSTATE\n1\tactive");
    if (commandName === "terminate") {
      await request("terminate", { restart: false });
      terminated = true;
      return line("EXIT: terminated");
    }
    reportError("invalid-args");
  } catch (error) {
    reportError(classify(error));
  }
}

const isMain = argv[1] && pathToFileURL(argv[1]).href === import.meta.url;
if (isMain) {
  let chain = Promise.resolve();
  const input = createInterface({ input: stdin, crlfDelay: Infinity });
  input.on("line", (value) => {
    chain = chain.then(() => handleCommand(value)).catch(() => reportError("adapter-failed"));
  });
}
