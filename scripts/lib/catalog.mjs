import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  compareText,
  fileStatus,
  report,
  repositoryPath,
} from "./validation-utils.mjs";

const PORTABLE_SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/u;
const VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ROOT_FIELDS = new Set(["skills"]);
const SKILL_FIELDS = new Set(["files", "name", "version"]);

function escapeDiagnosticControls(message) {
  return message.replace(/[\u0000-\u001f\u007f-\u009f]/gu, (character) => {
    if (character === "\n") {
      return "\\n";
    }
    if (character === "\r") {
      return "\\r";
    }
    if (character === "\t") {
      return "\\t";
    }
    return `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}

function catalogDiagnostic(errors, message) {
  report(errors, {
    path: "skills/index.json",
    line: 1,
    message: escapeDiagnosticControls(message),
  });
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownFields(record, allowedFields) {
  return Object.keys(record)
    .filter((field) => !allowedFields.has(field))
    .sort(compareText);
}

export function isPortableSkillName(skillName) {
  return PORTABLE_SKILL_NAME.test(skillName);
}

function isSafeCatalogPath(filePath) {
  if (path.posix.isAbsolute(filePath) || filePath.includes("\\")) {
    return false;
  }
  return filePath.split("/").every(
    (segment) => segment !== "." && segment !== ".." && SAFE_PATH_SEGMENT.test(segment),
  );
}

async function collectPackageFiles(skillPath) {
  const files = [];
  async function collect(currentPath) {
    const entries = (await readdir(currentPath, { withFileTypes: true }))
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await collect(entryPath);
      } else if (entry.isFile()) {
        files.push(repositoryPath(skillPath, entryPath));
      }
    }
  }
  await collect(skillPath);
  return files.sort(compareText);
}

async function contentVersion(skillPath, files) {
  const hash = createHash("sha256");
  for (const file of files) {
    const fileBytes = await readFile(path.join(skillPath, ...file.split("/")));
    for (const value of [Buffer.from(file), fileBytes]) {
      hash.update(`${value.length}:`);
      hash.update(value);
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

async function packageMetadata(repositoryRoot, skillName) {
  const skillPath = path.join(repositoryRoot, "skills", skillName);
  const files = await collectPackageFiles(skillPath);
  return { files, version: await contentVersion(skillPath, files) };
}

async function validateCatalogFiles(context, files) {
  const { errors, packageNames, repositoryRoot, skillName } = context;
  const filePaths = [];
  const seenPaths = new Set();
  for (const [fileIndex, filePath] of files.entries()) {
    if (typeof filePath !== "string" || filePath === "") {
      catalogDiagnostic(errors, `Catalog skill '${skillName}' file entry ${fileIndex + 1} must be a non-empty string.`);
      continue;
    }
    filePaths.push(filePath);
    if (seenPaths.has(filePath)) {
      catalogDiagnostic(errors, `Catalog skill '${skillName}' contains duplicate file path '${filePath}'.`);
    }
    seenPaths.add(filePath);
    if (!isSafeCatalogPath(filePath)) {
      catalogDiagnostic(errors, `Catalog skill '${skillName}' contains unsafe file path '${filePath}'.`);
      continue;
    }
    if (!packageNames.has(skillName)) {
      continue;
    }
    const targetPath = path.join(repositoryRoot, "skills", skillName, ...filePath.split("/"));
    const status = await fileStatus(targetPath);
    if (status === "missing") {
      catalogDiagnostic(errors, `Catalog skill '${skillName}' file '${filePath}' does not exist.`);
    } else if (status !== "file") {
      catalogDiagnostic(errors, `Catalog skill '${skillName}' file '${filePath}' must be a regular non-symbolic-link file.`);
    }
  }
  if (filePaths.some((filePath, index) => index > 0 && compareText(filePaths[index - 1], filePath) > 0)) {
    catalogDiagnostic(errors, `Catalog skill '${skillName}' file paths must be sorted in ascending byte order.`);
  }
  return seenPaths;
}

async function validateCatalogEntry(context, entry, entryIndex) {
  const { errors, metadataByName, packageNames, repositoryRoot } = context;
  if (!isRecord(entry)) {
    catalogDiagnostic(errors, `Catalog skill entry ${entryIndex + 1} must be an object.`);
    return undefined;
  }
  for (const field of unknownFields(entry, SKILL_FIELDS)) {
    catalogDiagnostic(errors, `Catalog skill entry ${entryIndex + 1} contains unknown field '${field}'.`);
  }
  if (typeof entry.name !== "string" || !isPortableSkillName(entry.name)) {
    catalogDiagnostic(errors, `Catalog skill entry ${entryIndex + 1} field 'name' must use portable lowercase kebab-case.`);
    return typeof entry.name === "string" ? entry.name : undefined;
  }
  const skillName = entry.name;
  if (!packageNames.has(skillName)) {
    catalogDiagnostic(errors, `Catalog skill '${skillName}' does not match a skill package directory.`);
  }
  let metadata = metadataByName.get(skillName);
  if (packageNames.has(skillName) && metadata === undefined) {
    metadata = await packageMetadata(repositoryRoot, skillName);
    metadataByName.set(skillName, metadata);
  }
  if (typeof entry.version !== "string" || !VERSION_PATTERN.test(entry.version)) {
    catalogDiagnostic(errors, `Catalog skill '${skillName}' field 'version' must use format 'sha256:<64 lowercase hex digits>'.`);
  }
  if (metadata !== undefined && entry.version !== metadata.version) {
    catalogDiagnostic(errors, `Catalog skill '${skillName}' version must be '${metadata.version}' for current package content.`);
  }
  if (!Array.isArray(entry.files)) {
    catalogDiagnostic(errors, `Catalog skill '${skillName}' field 'files' must be an array.`);
    return skillName;
  }
  const seenPaths = await validateCatalogFiles(
    { errors, packageNames, repositoryRoot, skillName },
    entry.files,
  );
  if (packageNames.has(skillName)) {
    for (const distributedFile of metadata.files) {
      if (!seenPaths.has(distributedFile)) {
        catalogDiagnostic(errors, `Skill package '${skillName}' file '${distributedFile}' is missing from the catalog.`);
      }
    }
  }
  return skillName;
}

export async function validateCatalog(repositoryRoot, packageNames, errors) {
  const catalogPath = path.join(repositoryRoot, "skills", "index.json");
  const status = await fileStatus(catalogPath);
  if (status !== "file") {
    catalogDiagnostic(
      errors,
      status === "missing"
        ? "OpenCode v2 catalog is missing."
        : "OpenCode v2 catalog must be a regular file and must not be a symbolic link.",
    );
    return;
  }
  let catalog;
  try {
    catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      catalogDiagnostic(errors, "OpenCode v2 catalog contains invalid JSON.");
      return;
    }
    throw error;
  }
  if (!isRecord(catalog) || !Array.isArray(catalog.skills)) {
    catalogDiagnostic(errors, "Catalog root must be an object with a 'skills' array.");
    return;
  }
  for (const field of unknownFields(catalog, ROOT_FIELDS)) {
    catalogDiagnostic(errors, `Catalog root contains unknown field '${field}'.`);
  }

  const catalogNames = new Set();
  const metadataByName = new Map();
  for (const [entryIndex, entry] of catalog.skills.entries()) {
    const skillName = await validateCatalogEntry(
      { errors, metadataByName, packageNames, repositoryRoot },
      entry,
      entryIndex,
    );
    if (skillName === undefined) {
      continue;
    }
    if (catalogNames.has(skillName)) {
      catalogDiagnostic(errors, `Catalog contains duplicate skill entry '${skillName}'.`);
    }
    catalogNames.add(skillName);
  }
  for (const packageName of packageNames) {
    if (!catalogNames.has(packageName)) {
      catalogDiagnostic(errors, `Skill package '${packageName}' is missing from the catalog.`);
    }
  }
}
