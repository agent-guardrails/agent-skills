import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  compareText,
  escapesDirectory,
  pathExists,
  report,
  repositoryPath,
} from "./validation-utils.mjs";

const FORBIDDEN_REFERENCES = [
  { pattern: /precommit-review/iu, label: "precommit-review" },
  { pattern: /load_skills/iu, label: "load_skills" },
  { pattern: /\/Users\//iu, label: "/Users/" },
  { pattern: /yandex-team/iu, label: "yandex-team" },
];

const SCANNABLE_TEXT_EXTENSIONS = new Set([
  ".bash",
  ".c",
  ".cc",
  ".cjs",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".fish",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".kts",
  ".lua",
  ".md",
  ".mjs",
  ".php",
  ".pl",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

export async function collectScannableTextFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectScannableTextFiles(entryPath)));
    } else if (entry.isFile() && SCANNABLE_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

function markdownDestinations(line) {
  const destinations = [];
  const inlineLink = /!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+["'(][^)\n]*)?\)/gu;
  for (const match of line.matchAll(inlineLink)) {
    destinations.push(match[1]);
  }
  const referenceLink = /^\s{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/u.exec(line);
  if (referenceLink !== null) {
    destinations.push(referenceLink[1]);
  }
  return destinations;
}

function normalizeDestination(rawDestination) {
  const unwrapped = rawDestination.startsWith("<") && rawDestination.endsWith(">")
    ? rawDestination.slice(1, -1)
    : rawDestination;
  return unwrapped.split(/[?#]/u, 1)[0];
}

function isExternalDestination(destination) {
  return destination.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(destination);
}

function linkError(context, sourceFile, line, message) {
  report(context.errors, {
    path: repositoryPath(context.repositoryRoot, sourceFile),
    line,
    message,
  });
}

async function validateLink(context, sourceFile, link) {
  const { line, rawDestination } = link;
  if (rawDestination.startsWith("#") || isExternalDestination(rawDestination)) {
    return;
  }
  const normalized = normalizeDestination(rawDestination);
  if (normalized === "") {
    return;
  }
  if (path.isAbsolute(normalized)) {
    linkError(
      context,
      sourceFile,
      line,
      `Markdown link target must be relative to the skill package: ${rawDestination}`,
    );
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(normalized);
  } catch (error) {
    if (error instanceof URIError) {
      linkError(
        context,
        sourceFile,
        line,
        `Markdown link target contains invalid percent encoding: ${rawDestination}`,
      );
      return;
    }
    throw error;
  }
  const targetPath = path.resolve(path.dirname(sourceFile), decoded);
  if (escapesDirectory(context.skillPath, targetPath)) {
    linkError(
      context,
      sourceFile,
      line,
      `Relative Markdown link escapes the skill directory: ${rawDestination}`,
    );
    return;
  }
  if (!(await pathExists(targetPath))) {
    linkError(
      context,
      sourceFile,
      line,
      `Relative Markdown link target does not exist: ${rawDestination}`,
    );
    return;
  }
  const targetRealPath = await realpath(targetPath);
  if (escapesDirectory(context.skillRealPath, targetRealPath)) {
    linkError(
      context,
      sourceFile,
      line,
      `Relative Markdown link resolves outside the skill directory: ${rawDestination}`,
    );
  }
}

export async function validateTextFile(context, sourceFile) {
  const text = await readFile(sourceFile, "utf8");
  const lines = text.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    for (const forbidden of FORBIDDEN_REFERENCES) {
      if (forbidden.pattern.test(line)) {
        linkError(
          context,
          sourceFile,
          index + 1,
          `Forbidden private dependency or machine-local reference: ${forbidden.label}`,
        );
      }
    }
  }
  if (path.extname(sourceFile).toLowerCase() !== ".md") {
    return;
  }

  let fence;
  for (const [index, line] of lines.entries()) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1][0];
      if (fence === undefined) {
        fence = marker;
      } else if (fence === marker) {
        fence = undefined;
      }
      continue;
    }
    if (fence !== undefined) {
      continue;
    }
    const prose = line.replace(/(`+)[^`]*\1/gu, "");
    for (const rawDestination of markdownDestinations(prose)) {
      await validateLink(context, sourceFile, { line: index + 1, rawDestination });
    }
  }
}
