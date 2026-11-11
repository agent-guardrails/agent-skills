import { lstat, stat } from "node:fs/promises";
import path from "node:path";

export function repositoryPath(repositoryRoot, targetPath) {
  return path.relative(repositoryRoot, targetPath).split(path.sep).join("/");
}

export function report(errors, diagnostic) {
  errors.push(diagnostic);
}

export function compareText(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function fileStatus(targetPath) {
  try {
    const status = await lstat(targetPath);
    if (status.isSymbolicLink()) {
      return "symlink";
    }
    return status.isFile() ? "file" : "other";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
}

export function escapesDirectory(rootPath, targetPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}
