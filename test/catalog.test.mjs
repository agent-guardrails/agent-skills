import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateRepository as validateRepositoryWithoutCatalog } from "../scripts/validate-skills.mjs";
import {
  REQUIRED_P0_SKILLS,
  collectPackageFiles,
  contentVersion,
  createRepository,
  createSkill,
  ensureRequiredP0Skills,
  writeValidCatalog,
} from "./helpers/repository-fixtures.mjs";

const validatorPath = fileURLToPath(
  new URL("../scripts/validate-skills.mjs", import.meta.url),
);

function catalogMessages(errors) {
  return errors
    .filter(({ path: errorPath }) => errorPath === "skills/index.json")
    .map(({ message }) => message);
}

test("requires the OpenCode v2 catalog", async () => {
  const repositoryPath = await createRepository();
  await createSkill(repositoryPath, "portable");

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), ["OpenCode v2 catalog is missing."]);
});

test("reports malformed catalog JSON", async () => {
  const repositoryPath = await createRepository();
  await createSkill(repositoryPath, "portable");
  await writeFile(path.join(repositoryPath, "skills", "index.json"), "{not-json\n");

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), ["OpenCode v2 catalog contains invalid JSON."]);
});

test("rejects symlinked and broken-symlink catalogs", async (t) => {
  for (const [name, target] of [
    ["existing target", "catalog-target.json"],
    ["missing target", "missing-catalog.json"],
  ]) {
    await t.test(name, async () => {
      const repositoryPath = await createRepository();
      await createSkill(repositoryPath, "portable");
      if (name === "existing target") {
        await writeFile(path.join(repositoryPath, target), "{\"skills\":[]}\n");
      }
      await symlink(path.join(repositoryPath, target), path.join(repositoryPath, "skills", "index.json"));

      const errors = await validateRepositoryWithoutCatalog(repositoryPath);

      assert.deepEqual(catalogMessages(errors), [
        "OpenCode v2 catalog must be a regular file and must not be a symbolic link.",
      ]);
    });
  }
});

test("reports catalog schema errors", async (t) => {
  const cases = [
    ["non-object root", [], "Catalog root must be an object with a 'skills' array."],
    ["missing skills", {}, "Catalog root must be an object with a 'skills' array."],
    ["non-array skills", { skills: {} }, "Catalog root must be an object with a 'skills' array."],
    ["non-object entry", { skills: [null] }, "Catalog skill entry 1 must be an object."],
    ["invalid name", { skills: [{ name: "", version: `sha256:${"0".repeat(64)}`, files: [] }] }, "Catalog skill entry 1 field 'name' must use portable lowercase kebab-case."],
    ["invalid version", { skills: [{ name: "portable", version: "1", files: [] }] }, "Catalog skill 'portable' field 'version' must use format 'sha256:<64 lowercase hex digits>'."],
    ["invalid files", { skills: [{ name: "portable", version: `sha256:${"0".repeat(64)}`, files: "SKILL.md" }] }, "Catalog skill 'portable' field 'files' must be an array."],
    ["invalid file value", { skills: [{ name: "portable", version: `sha256:${"0".repeat(64)}`, files: [false] }] }, "Catalog skill 'portable' file entry 1 must be a non-empty string."],
  ];
  for (const [name, catalog, expected] of cases) {
    await t.test(name, async () => {
      const repositoryPath = await createRepository();
      await createSkill(repositoryPath, "portable");
      await writeFile(
        path.join(repositoryPath, "skills", "index.json"),
        `${JSON.stringify(catalog)}\n`,
      );

      const errors = await validateRepositoryWithoutCatalog(repositoryPath);

      assert.ok(catalogMessages(errors).includes(expected));
    });
  }
});

test("rejects unknown catalog root and entry fields", async (t) => {
  for (const [name, mutate, expected] of [
    [
      "root field",
      (catalog) => { catalog.unexpected = true; },
      "Catalog root contains unknown field 'unexpected'.",
    ],
    [
      "entry field",
      (catalog) => { catalog.skills[0].unexpected = true; },
      "Catalog skill entry 1 contains unknown field 'unexpected'.",
    ],
  ]) {
    await t.test(name, async () => {
      const repositoryPath = await createRepository();
      await createSkill(repositoryPath, "portable");
      await writeValidCatalog(repositoryPath);
      const catalogPath = path.join(repositoryPath, "skills", "index.json");
      const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
      mutate(catalog);
      await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

      const errors = await validateRepositoryWithoutCatalog(repositoryPath);

      assert.deepEqual(catalogMessages(errors), [expected]);
    });
  }
});

test("escapes controls in catalog-derived diagnostic values", async () => {
  const repositoryPath = await createRepository();
  await createSkill(repositoryPath, "portable");
  await writeValidCatalog(repositoryPath);
  const catalogPath = path.join(repositoryPath, "skills", "index.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const injected = "bad\u0000\u0001\t\n\u000b\f\r\u001b\u001f\u007f\u0080\u0085\u009f";
  const escaped = "bad\\x00\\x01\\t\\n\\x0b\\x0c\\r\\x1b\\x1f\\x7f\\x80\\x85\\x9f";
  catalog[injected] = true;
  catalog.skills[0][injected] = true;
  catalog.skills[0].files.push(`${injected}.md`);
  const invalidEntry = {
    name: injected,
    version: `sha256:${"0".repeat(64)}`,
    files: [],
  };
  catalog.skills.push(invalidEntry, invalidEntry);
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);
  const messages = catalogMessages(errors);

  assert.ok(messages.includes(`Catalog root contains unknown field '${escaped}'.`));
  assert.ok(messages.includes(`Catalog skill entry 1 contains unknown field '${escaped}'.`));
  assert.ok(messages.includes(`Catalog skill 'portable' contains unsafe file path '${escaped}.md'.`));
  assert.ok(messages.includes(`Catalog contains duplicate skill entry '${escaped}'.`));
  assert.equal(messages.some((message) => /[\u0000-\u001f\u007f-\u009f]/u.test(message)), false);
});

test("CLI bounds escaped catalog diagnostics to 50 physical records", async () => {
  const repositoryPath = await createRepository();
  await ensureRequiredP0Skills(repositoryPath);
  await writeValidCatalog(repositoryPath);
  const catalogPath = path.join(repositoryPath, "skills", "index.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  for (let index = 0; index < 60; index += 1) {
    catalog[`bad\nskills/fake:${String(index).padStart(2, "0")}: forged\r\t\u001b\u007f\u0085`] = true;
  }
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const firstRun = spawnSync(process.execPath, [validatorPath, repositoryPath], {
    encoding: "utf8",
  });
  const secondRun = spawnSync(process.execPath, [validatorPath, repositoryPath], {
    encoding: "utf8",
  });

  assert.equal(firstRun.status, 1);
  assert.equal(firstRun.stderr, secondRun.stderr);
  const outputLines = firstRun.stderr.trimEnd().split("\n");
  assert.equal(outputLines.length, 51);
  for (const diagnostic of outputLines.slice(0, 50)) {
    assert.match(
      diagnostic,
      /^skills\/index\.json:1: Catalog root contains unknown field 'bad\\nskills\/fake:\d{2}: forged\\r\\t\\x1b\\x7f\\x85'\.$/u,
    );
  }
  assert.equal(outputLines[50], "Validation stopped after 50 errors.");
});

test("requires every P0 skill while allowing additional packages", async (t) => {
  for (const removedSkill of REQUIRED_P0_SKILLS) {
    await t.test(removedSkill, async () => {
      const repositoryPath = await createRepository();
      await ensureRequiredP0Skills(repositoryPath);
      await createSkill(repositoryPath, "future-skill");
      await writeValidCatalog(repositoryPath);
      await rm(path.join(repositoryPath, "skills", removedSkill), { recursive: true });
      const catalogPath = path.join(repositoryPath, "skills", "index.json");
      const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
      catalog.skills = catalog.skills.filter(({ name }) => name !== removedSkill);
      await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

      const errors = await validateRepositoryWithoutCatalog(repositoryPath);

      assert.deepEqual(errors, [{
        path: `skills/${removedSkill}`,
        line: 1,
        message: "Required P0 skill package is missing.",
      }]);
    });
  }
});

test("rejects non-portable skill package and catalog names", async () => {
  const repositoryPath = await createRepository();
  await ensureRequiredP0Skills(repositoryPath);
  await createSkill(repositoryPath, "Bad_Name");
  await writeValidCatalog(repositoryPath);
  const catalog = JSON.parse(
    await readFile(path.join(repositoryPath, "skills", "index.json"), "utf8"),
  );
  const invalidEntry = catalog.skills.findIndex(({ name }) => name === "Bad_Name") + 1;

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(errors.map(({ path: errorPath, message }) => `${errorPath}: ${message}`), [
    "skills/Bad_Name: Skill package name must use portable lowercase kebab-case.",
    `skills/index.json: Catalog skill entry ${invalidEntry} field 'name' must use portable lowercase kebab-case.`,
  ]);
});

test("reports duplicate catalog entries and packages missing from the catalog", async () => {
  const repositoryPath = await createRepository();
  await createSkill(repositoryPath, "alpha");
  await createSkill(repositoryPath, "beta");
  const alphaPath = path.join(repositoryPath, "skills", "alpha");
  const alphaFiles = await collectPackageFiles(alphaPath);
  const alphaVersion = await contentVersion(alphaPath, alphaFiles);
  const catalog = {
    skills: [
      { name: "alpha", version: alphaVersion, files: alphaFiles },
      { name: "alpha", version: alphaVersion, files: alphaFiles },
    ],
  };
  await writeFile(
    path.join(repositoryPath, "skills", "index.json"),
    `${JSON.stringify(catalog)}\n`,
  );

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), [
    "Catalog contains duplicate skill entry 'alpha'.",
    "Skill package 'beta' is missing from the catalog.",
  ]);
});

test("reports catalog entries that do not match a skill package", async () => {
  const repositoryPath = await createRepository();
  const catalog = {
    skills: [{ name: "ghost", version: `sha256:${"0".repeat(64)}`, files: ["SKILL.md"] }],
  };
  await writeFile(
    path.join(repositoryPath, "skills", "index.json"),
    `${JSON.stringify(catalog)}\n`,
  );

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), [
    "Catalog skill 'ghost' does not match a skill package directory.",
  ]);
});

test("rejects unsafe, duplicate, and unsorted catalog file paths", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "portable");
  const catalog = {
    skills: [{
      name: "portable",
      version: await contentVersion(skillPath),
      files: [
        "SKILL.md",
        "LICENSE.md",
        "NOTICE.md",
        "NOTICE.md",
        "/absolute.md",
        "../escape.md",
        "references\\windows.md",
        "./LICENSE.md",
        "references/../LICENSE.md",
        "references/%2e%2e/LICENSE.md",
        "references/query?.md",
        "references/fragment#.md",
        "references/control\u0001.md",
      ],
    }],
  };
  await writeFile(
    path.join(repositoryPath, "skills", "index.json"),
    `${JSON.stringify(catalog)}\n`,
  );

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), [
    "Catalog skill 'portable' contains duplicate file path 'NOTICE.md'.",
    "Catalog skill 'portable' contains unsafe file path '../escape.md'.",
    "Catalog skill 'portable' contains unsafe file path './LICENSE.md'.",
    "Catalog skill 'portable' contains unsafe file path '/absolute.md'.",
    "Catalog skill 'portable' contains unsafe file path 'references/%2e%2e/LICENSE.md'.",
    "Catalog skill 'portable' contains unsafe file path 'references/../LICENSE.md'.",
    "Catalog skill 'portable' contains unsafe file path 'references/control\\x01.md'.",
    "Catalog skill 'portable' contains unsafe file path 'references/fragment#.md'.",
    "Catalog skill 'portable' contains unsafe file path 'references/query?.md'.",
    "Catalog skill 'portable' contains unsafe file path 'references\\windows.md'.",
    "Catalog skill 'portable' file paths must be sorted in ascending byte order.",
  ]);
});

test("rejects catalog paths for missing, non-file, and symlink targets", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "portable");
  await mkdir(path.join(skillPath, "directory"));
  await symlink(path.join(skillPath, "SKILL.md"), path.join(skillPath, "linked.md"));
  const catalog = {
    skills: [{
      name: "portable",
      version: await contentVersion(skillPath),
      files: ["LICENSE.md", "NOTICE.md", "SKILL.md", "directory", "linked.md", "missing.md"],
    }],
  };
  await writeFile(
    path.join(repositoryPath, "skills", "index.json"),
    `${JSON.stringify(catalog)}\n`,
  );

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), [
    "Catalog skill 'portable' file 'directory' must be a regular non-symbolic-link file.",
    "Catalog skill 'portable' file 'linked.md' must be a regular non-symbolic-link file.",
    "Catalog skill 'portable' file 'missing.md' does not exist.",
  ]);
});

test("reports distributed package files missing from the catalog", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "portable");
  const catalog = {
    skills: [{
      name: "portable",
      version: await contentVersion(skillPath),
      files: ["LICENSE.md", "SKILL.md"],
    }],
  };
  await writeFile(
    path.join(repositoryPath, "skills", "index.json"),
    `${JSON.stringify(catalog)}\n`,
  );

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(errors), [
    "Skill package 'portable' file 'NOTICE.md' is missing from the catalog.",
  ]);
});

test("rejects a stale content-derived version after file bytes change", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "portable");
  await writeValidCatalog(repositoryPath);
  await writeFile(path.join(skillPath, "NOTICE.md"), "Changed notice\n");

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.equal(catalogMessages(errors).length, 1);
  assert.match(
    catalogMessages(errors)[0],
    /^Catalog skill 'portable' version must be 'sha256:[0-9a-f]{64}' for current package content\.$/u,
  );
});

test("includes sorted relative paths in the content-derived version", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "portable");
  await writeFile(path.join(skillPath, "a.txt"), "same bytes\n");
  await writeValidCatalog(repositoryPath);
  const catalogPath = path.join(repositoryPath, "skills", "index.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  await rename(path.join(skillPath, "a.txt"), path.join(skillPath, "b.txt"));
  catalog.skills[0].files = catalog.skills[0].files.map((file) => file === "a.txt" ? "b.txt" : file).sort();
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const errors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.equal(catalogMessages(errors).length, 1);
  assert.match(catalogMessages(errors)[0], /version must be 'sha256:[0-9a-f]{64}'/u);
});

test("matches an independent known-answer digest and rejects byte and path changes", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "vector");
  const catalog = {
    skills: [{
      name: "vector",
      version: "sha256:b6c8f61a9ce90dd46e4e277f30c7b8ff4104a6fb119aeb2519eae6c88b4d064e",
      files: ["LICENSE.md", "NOTICE.md", "SKILL.md"],
    }],
  };
  const catalogPath = path.join(repositoryPath, "skills", "index.json");
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const validErrors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.deepEqual(catalogMessages(validErrors), []);

  await writeFile(path.join(skillPath, "NOTICE.md"), "Noticf\n");
  const staleErrors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.equal(catalogMessages(staleErrors).length, 1);
  assert.match(catalogMessages(staleErrors)[0], /version must be 'sha256:[0-9a-f]{64}'/u);

  await writeFile(path.join(skillPath, "NOTICE.md"), "Notice\n");
  await rename(path.join(skillPath, "NOTICE.md"), path.join(skillPath, "NOTICE.txt"));
  catalog.skills[0].files = ["LICENSE.md", "NOTICE.txt", "SKILL.md"];
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const renamedErrors = await validateRepositoryWithoutCatalog(repositoryPath);

  assert.equal(catalogMessages(renamedErrors).length, 1);
  assert.match(catalogMessages(renamedErrors)[0], /version must be 'sha256:[0-9a-f]{64}'/u);
});
