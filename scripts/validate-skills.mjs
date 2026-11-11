#!/usr/bin/env node

import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { validateFrontmatter } from "./lib/frontmatter.mjs";
import { collectScannableTextFiles, validateTextFile } from "./lib/markdown.mjs";
import {
  compareText,
  fileStatus,
  pathExists,
  report,
  repositoryPath,
} from "./lib/validation-utils.mjs";

const MAX_ERRORS = 50;
const REQUIRED_FILES = ["LICENSE.md", "NOTICE.md", "SKILL.md"];

async function validateSkill(repositoryRoot, skillEntry, errors) {
  const skillPath = path.join(repositoryRoot, "skills", skillEntry.name);
  let skillFileIsRegular = false;
  const requiredSymbolicLinks = new Set();
  for (const requiredFile of REQUIRED_FILES) {
    const requiredPath = path.join(skillPath, requiredFile);
    const status = await fileStatus(requiredPath);
    if (requiredFile === "SKILL.md") {
      skillFileIsRegular = status === "file";
    }
    if (status !== "file") {
      if (status === "symlink") {
        requiredSymbolicLinks.add(requiredPath);
      }
      report(errors, {
        path: repositoryPath(repositoryRoot, requiredPath),
        line: 1,
        message: status === "missing"
          ? "Required file is missing."
          : status === "symlink"
            ? "Required file must be a regular file and must not be a symbolic link."
            : "Required file is missing or is not a regular file.",
      });
    }
  }
  const skillFilePath = path.join(skillPath, "SKILL.md");
  if (skillFileIsRegular) {
    validateFrontmatter(await readFile(skillFilePath, "utf8"), {
      errors,
      skillFile: repositoryPath(repositoryRoot, skillFilePath),
      skillName: skillEntry.name,
    });
  }
  const context = {
    errors,
    repositoryRoot,
    skillPath,
    skillRealPath: await realpath(skillPath),
  };
  const collected = await collectScannableTextFiles(skillPath);
  for (const symbolicLink of collected.symbolicLinks) {
    if (requiredSymbolicLinks.has(symbolicLink)) {
      continue;
    }
    report(errors, {
      path: repositoryPath(repositoryRoot, symbolicLink),
      line: 1,
      message: "Skill package content must not contain symbolic links.",
    });
  }
  for (const textFile of collected.files) {
    await validateTextFile(context, textFile);
  }
}

async function validateRepositoryWithMetadata(repositoryRoot) {
  const absoluteRoot = path.resolve(repositoryRoot);
  const skillsPath = path.join(absoluteRoot, "skills");
  const errors = [];
  if (!(await pathExists(skillsPath))) {
    report(errors, { path: "skills", line: 1, message: "Skills directory is missing." });
  } else {
    const entries = [];
    let symbolicLinkCount = 0;
    const packageEntries = (await readdir(skillsPath, { withFileTypes: true }))
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of packageEntries) {
      const entryPath = path.join(skillsPath, entry.name);
      const status = await lstat(entryPath);
      if (status.isSymbolicLink()) {
        symbolicLinkCount += 1;
        report(errors, {
          path: repositoryPath(absoluteRoot, entryPath),
          line: 1,
          message: "Skill package entry must be a directory and must not be a symbolic link.",
        });
      } else if (status.isDirectory()) {
        entries.push(entry);
      }
    }
    if (entries.length === 0 && symbolicLinkCount === 0) {
      report(errors, { path: "skills", line: 1, message: "No skill packages found." });
    }
    for (const entry of entries) {
      await validateSkill(absoluteRoot, entry, errors);
    }
  }
  errors.sort(
    (left, right) =>
      compareText(left.path, right.path) || left.line - right.line || compareText(left.message, right.message),
  );
  return { errors: errors.slice(0, MAX_ERRORS), truncated: errors.length > MAX_ERRORS };
}

export async function validateRepository(repositoryRoot) {
  return (await validateRepositoryWithMetadata(repositoryRoot)).errors;
}

async function main() {
  const repositoryRoot = process.argv[2] ?? process.cwd();
  const result = await validateRepositoryWithMetadata(repositoryRoot);
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error.path}:${error.line}: ${error.message}\n`);
    }
    if (result.truncated) {
      process.stderr.write(`Validation stopped after ${MAX_ERRORS} errors.\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Skill repository validation passed.\n");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
