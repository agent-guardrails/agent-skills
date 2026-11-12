import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateRepository as validateRepositoryWithoutCatalog } from "../../scripts/validate-skills.mjs";

export const REQUIRED_P0_SKILLS = [
  "ast-grep",
  "coding-agent-sessions",
  "debugging",
  "git-master",
  "lsp-setup",
  "review-work",
];

export async function createRepository() {
  const repositoryPath = await mkdtemp(path.join(tmpdir(), "agent-skills-validator-"));
  await mkdir(path.join(repositoryPath, "skills"));
  return repositoryPath;
}

export async function createSkill(
  repositoryPath,
  skillName,
  skillMarkdown = `---\nname: ${skillName}\ndescription: Portable test skill.\n---\n`,
) {
  const skillPath = path.join(repositoryPath, "skills", skillName);
  await mkdir(skillPath, { recursive: true });
  await Promise.all([
    writeFile(path.join(skillPath, "SKILL.md"), skillMarkdown),
    writeFile(path.join(skillPath, "LICENSE.md"), "License\n"),
    writeFile(path.join(skillPath, "NOTICE.md"), "Notice\n"),
  ]);
  return skillPath;
}

export async function collectPackageFiles(skillPath, currentPath = skillPath) {
  const files = [];
  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectPackageFiles(skillPath, entryPath));
    } else if (entry.isFile()) {
      files.push(path.relative(skillPath, entryPath).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

export async function contentVersion(skillPath, packageFiles) {
  const files = packageFiles ?? await collectPackageFiles(skillPath);
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

export async function writeValidCatalog(repositoryPath) {
  const skillsPath = path.join(repositoryPath, "skills");
  const entries = await readdir(skillsPath, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = path.join(skillsPath, entry.name);
    skills.push({
      name: entry.name,
      version: await contentVersion(skillPath),
      files: await collectPackageFiles(skillPath),
    });
  }
  skills.sort((left, right) => left.name.localeCompare(right.name));
  await writeFile(path.join(skillsPath, "index.json"), `${JSON.stringify({ skills }, null, 2)}\n`);
}

export async function ensureRequiredP0Skills(repositoryPath) {
  const skillsPath = path.join(repositoryPath, "skills");
  const existingNames = new Set(await readdir(skillsPath));
  for (const skillName of REQUIRED_P0_SKILLS) {
    if (!existingNames.has(skillName)) {
      await createSkill(repositoryPath, skillName);
    }
  }
}

export async function validateRepository(repositoryPath) {
  await ensureRequiredP0Skills(repositoryPath);
  await writeValidCatalog(repositoryPath);
  return validateRepositoryWithoutCatalog(repositoryPath);
}
