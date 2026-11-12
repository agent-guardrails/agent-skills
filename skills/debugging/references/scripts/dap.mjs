#!/usr/bin/env node
// allow: SIZE_OK - single-file, zero-dependency DAP REPL kept portable for direct installation.
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { argv, env, stderr, stdin, stdout } from "node:process";

export const MAX_ROWS = 100;
export const MAX_OUTPUT_BYTES = 32 * 1024;
export const MAX_HEADER_BYTES = 8 * 1024;
export const MAX_FRAME_BYTES = 1024 * 1024;
export const MAX_RETAINED_BYTES = 2 * 1024 * 1024;
export const MAX_STDERR_BYTES = 32 * 1024;
export const MAX_FIELD_BYTES = 4 * 1024;

function tcpAdapterEndpoint(spec) {
  const match = /^(?:127\.0\.0\.1|(\[::1\])):(\d+)$/.exec(spec);
  if (!match) return null;
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return { host: match[1] ? "::1" : "127.0.0.1", port };
}

export function isTcpAdapterSpec(spec) {
  return tcpAdapterEndpoint(spec) !== null;
}

function escapedField(value, maximumBytes) {
  let output = "";
  let outputBytes = 0;
  for (const character of String(value ?? "")) {
    const codePoint = character.codePointAt(0);
    let fragment = character;
    if (codePoint === 9) fragment = "\\t";
    else if (codePoint === 10) fragment = "\\n";
    else if (codePoint === 13) fragment = "\\r";
    else if (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)) fragment = `\\x${codePoint.toString(16).padStart(2, "0")}`;
    const fragmentBytes = Buffer.byteLength(fragment);
    if (outputBytes + fragmentBytes > maximumBytes) break;
    output += fragment;
    outputBytes += fragmentBytes;
  }
  return output;
}

export function renderAdapterField(value) {
  return escapedField(value, MAX_FIELD_BYTES);
}

export class DapFrameParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.failed = false;
  }

  fail() {
    this.failed = true;
    this.buffer = Buffer.alloc(0);
    throw new Error("malformed-frame");
  }

  parseAvailable(messages) {
    while (true) {
      const marker = this.buffer.indexOf(Buffer.from("\r\n\r\n"));
      if (marker < 0) {
        if (this.buffer.length >= MAX_HEADER_BYTES) this.fail();
        return;
      }
      if (marker + 4 > MAX_HEADER_BYTES) this.fail();
      const headerBytes = this.buffer.subarray(0, marker);
      for (const byte of headerBytes) {
        if ((byte < 32 && byte !== 9 && byte !== 13 && byte !== 10) || byte > 126) this.fail();
      }
      const contentLengths = [];
      for (const line of headerBytes.toString("ascii").split("\r\n")) {
        const header = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+):[ \t]*(.*)$/.exec(line);
        if (!header) this.fail();
        if (header[1].toLowerCase() !== "content-length") continue;
        if (!/^\d+$/.test(header[2].trim())) this.fail();
        contentLengths.push(header[2].trim());
      }
      if (contentLengths.length !== 1) this.fail();
      const length = Number(contentLengths[0]);
      if (!Number.isSafeInteger(length) || length > MAX_FRAME_BYTES) this.fail();
      const bodyStart = marker + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length);
      this.buffer = this.buffer.subarray(bodyStart + length);
      try {
        messages.push(JSON.parse(body.toString("utf8")));
      } catch {
        this.fail();
      }
    }
  }

  push(chunk) {
    if (this.failed) throw new Error("malformed-frame");
    const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const messages = [];
    let offset = 0;
    while (offset < input.length) {
      const available = MAX_RETAINED_BYTES - this.buffer.length;
      if (available === 0) this.fail();
      const consumed = Math.min(available, input.length - offset);
      this.buffer = Buffer.concat([this.buffer, input.subarray(offset, offset + consumed)]);
      offset += consumed;
      this.parseAvailable(messages);
    }
    return messages;
  }
}

const timeoutMs = Number(env.DAP_TIMEOUT_MS || 15_000);
let transport = null;
let nextSequence = 1;
let initialized = false;
let terminated = false;
let currentStop = null;
let topFrame = null;
let fatalTransportError = null;
const pending = new Map();
const breakpoints = new Map();
const eventWaiters = new Map();

function line(text) {
  stdout.write(`${text}\n`);
}

function reportError(kind, detail = "") {
  line(`ERR: ${kind}${detail ? ` ${detail}` : ""}`);
}

function reportCaught(error) {
  if (!error.reported) reportError(classify(error));
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
  if (env.DAP_DEBUG) stderr.write(`DAP ${direction} ${escapedField(JSON.stringify(message), 300)}\n`);
}

function send(message) {
  trace(">", message);
  const body = Buffer.from(JSON.stringify(message));
  transport.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
}

function request(commandName, requestArguments = {}) {
  if (!transport || terminated) return Promise.reject(fatalTransportError || new Error("no-session"));
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
    topFrame = null;
    emitEvent("stopped", currentStop);
  }
  if (message.event === "terminated" || message.event === "exited") {
    terminated = true;
    emitEvent("terminated");
  }
}

function connectTransport(writer, reader, destroy) {
  transport = { write: (chunk) => writer.write(chunk), destroy };
  const parser = new DapFrameParser();
  let malformed = false;
  reader.on("data", (chunk) => {
    if (malformed) return;
    try {
      for (const message of parser.push(chunk)) onMessage(message);
    } catch {
      malformed = true;
      terminated = true;
      fatalTransportError = new Error("malformed-frame");
      fatalTransportError.reported = true;
      reportError("malformed-frame");
      for (const waiter of pending.values()) waiter.reject(fatalTransportError);
      pending.clear();
      emitEvent("initialized");
      emitEvent("terminated");
      transport.destroy();
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
  const endpoint = tcpAdapterEndpoint(spec);
  if (endpoint) {
    const socket = createConnection(endpoint.port, endpoint.host);
    connectTransport(socket, socket, () => socket.destroy());
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    return;
  }
  const isScript = /\.(mjs|cjs|js)$/.test(spec);
  const [commandName, commandArguments] = isScript ? [process.execPath, [spec]] : [spec, []];
  const child = spawn(commandName, commandArguments, { stdio: ["pipe", "pipe", "pipe"] });
  let retainedStderr = Buffer.alloc(0);
  child.stderr.on("data", (chunk) => {
    if (chunk.length >= MAX_STDERR_BYTES) retainedStderr = Buffer.from(chunk.subarray(chunk.length - MAX_STDERR_BYTES));
    else retainedStderr = Buffer.from(Buffer.concat([retainedStderr, chunk]).subarray(-MAX_STDERR_BYTES));
  });
  connectTransport(child.stdin, child.stdout, () => {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    child.kill();
  });
  child.on("error", () => {
    if (!terminated) reportError("adapter-failed");
  });
}

async function waitForStop(required = true, graceMilliseconds) {
  if (fatalTransportError) throw fatalTransportError;
  if (currentStop || terminated) return Boolean(currentStop);
  await Promise.race([waitForEvent("stopped"), waitForEvent("terminated"), sleep(graceMilliseconds ?? timeoutMs)]);
  if (fatalTransportError) throw fatalTransportError;
  if (required && !currentStop && !terminated) throw new Error("timeout");
  return Boolean(currentStop);
}

async function waitForInitialization() {
  if (fatalTransportError) throw fatalTransportError;
  if (initialized) return;
  await Promise.race([waitForEvent("initialized"), sleep(timeoutMs)]);
  if (fatalTransportError) throw fatalTransportError;
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
  if (["timeout", "adapter-error", "no-session", "no-frame", "malformed-frame"].includes(error.message)) return error.message;
  return "adapter-failed";
}

async function launch(adapter, program, programArguments) {
  if (!adapter || !program) return reportError("invalid-args");
  if (transport) return reportError("adapter-error", "session already exists");
  try {
    await startAdapter(adapter);
    await request("initialize", { clientID: "portable-dap-client", adapterID: adapterIdFor(adapter), linesStartAt1: true, columnsStartAt1: true, pathFormat: "path" });
    const launchResult = request("launch", { program, args: programArguments, console: "internalConsole", justMyCode: false, stopOnEntry: true }).then(
      () => ({ error: null }),
      (error) => ({ error }),
    );
    await waitForInitialization();
    const [launchOutcome] = await Promise.all([launchResult, request("configurationDone")]);
    if (launchOutcome.error) throw launchOutcome.error;
    await waitForStop(false, 2_000);
    line("READY: launch");
  } catch (error) {
    reportCaught(error);
  }
}

async function snapshot() {
  if (terminated) return line("EXIT: terminated");
  try {
    const response = await request("stackTrace", { threadId: currentStop?.threadId || 1, levels: 1 });
    topFrame = response.body?.stackFrames?.[0];
    const frame = topFrame;
    if (frame) line(`STOP: stopped reason=${renderAdapterField(currentStop?.reason || "unknown")} threadId=${renderAdapterField(currentStop?.threadId || "")} ${renderAdapterField(frame.name)} at ${renderAdapterField(frame.source?.path || "?")}:${renderAdapterField(frame.line || 0)}:${renderAdapterField(frame.column || 0)}`);
    else line(`STOP: stopped reason=${renderAdapterField(currentStop?.reason || "unknown")} threadId=${renderAdapterField(currentStop?.threadId || "")} ? at ?:0:0`);
  } catch (error) {
    reportCaught(error);
  }
}

async function frameForCurrentStop() {
  if (topFrame) return topFrame;
  const response = await request("stackTrace", { threadId: currentStop?.threadId || 1, levels: 1 });
  const frame = response.body?.stackFrames?.[0];
  if (!Number.isInteger(frame?.id)) throw new Error("no-frame");
  topFrame = frame;
  return frame;
}

function boundedTable(header, rows) {
  let output = `${header.map((field) => renderAdapterField(field)).join("\t")}\n`;
  let outputBytes = Buffer.byteLength(output);
  let count = 0;
  let droppedRows = 0;
  let droppedBytes = 0;
  for (const row of rows) {
    const candidate = `${row.map((field) => renderAdapterField(field)).join("\t")}\n`;
    const candidateBytes = Buffer.byteLength(candidate);
    if (count < MAX_ROWS && outputBytes + candidateBytes <= MAX_OUTPUT_BYTES) {
      output += candidate;
      outputBytes += candidateBytes;
      count++;
    } else {
      droppedRows++;
      droppedBytes += candidateBytes;
    }
  }
  stdout.write(output);
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
      reportCaught(error);
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
      topFrame = null;
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
      const frame = await frameForCurrentStop();
      const response = await request("scopes", { frameId: frame.id });
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
      const frame = await frameForCurrentStop();
      const response = await request("evaluate", { expression: parts.join(" "), frameId: frame.id });
      line(`EVAL\t${renderAdapterField(response.body?.result || "")}`);
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
    reportCaught(error);
  }
}

const isMain = argv[1] && pathToFileURL(argv[1]).href === import.meta.url;
if (isMain) {
  let chain = Promise.resolve();
  const input = createInterface({ input: stdin, crlfDelay: Infinity });
  input.on("line", (value) => {
    chain = chain.then(() => handleCommand(value)).catch((error) => reportCaught(error));
  });
}
