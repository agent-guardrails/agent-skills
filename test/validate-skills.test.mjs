import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateRepository } from "../scripts/validate-skills.mjs";

const validatorPath = fileURLToPath(
  new URL("../scripts/validate-skills.mjs", import.meta.url),
);

async function createRepository() {
  const repositoryPath = await mkdtemp(path.join(tmpdir(), "agent-skills-validator-"));
  await mkdir(path.join(repositoryPath, "skills"));
  return repositoryPath;
}

async function createSkill(
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

test("accepts a valid skill package with portable Markdown links", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(
    repositoryPath,
    "portable",
    `---\nname: portable\ndescription: "Portable test skill."\n---\n\n[Guide](references/guide.md#usage)\n[Website](https://example.com/docs)\n[Email](mailto:maintainer@example.com)\n[Section](#usage)\n`,
  );
  await mkdir(path.join(skillPath, "references", "files"), { recursive: true });
  await writeFile(
    path.join(skillPath, "references", "guide.md"),
    "[Fixture](files/example.txt?raw=1#sample)\n",
  );
  await writeFile(path.join(skillPath, "references", "files", "example.txt"), "ok\n");

  const errors = await validateRepository(repositoryPath);

  assert.deepEqual(errors, []);
});

test("reports every missing required package file", async () => {
  const repositoryPath = await createRepository();
  await mkdir(path.join(repositoryPath, "skills", "incomplete"));

  const errors = await validateRepository(repositoryPath);

  assert.deepEqual(
    errors.map(({ path: errorPath, line, message }) => `${errorPath}:${line}: ${message}`),
    [
      "skills/incomplete/LICENSE.md:1: Required file is missing.",
      "skills/incomplete/NOTICE.md:1: Required file is missing.",
      "skills/incomplete/SKILL.md:1: Required file is missing.",
    ],
  );
});

test("rejects a directory in place of a required file", async () => {
  const repositoryPath = await createRepository();
  const skillPath = path.join(repositoryPath, "skills", "invalid");
  await mkdir(path.join(skillPath, "SKILL.md"), { recursive: true });
  await Promise.all([
    writeFile(path.join(skillPath, "LICENSE.md"), "License\n"),
    writeFile(path.join(skillPath, "NOTICE.md"), "Notice\n"),
  ]);

  const errors = await validateRepository(repositoryPath);

  assert.deepEqual(errors, [
    {
      path: "skills/invalid/SKILL.md",
      line: 1,
      message: "Required file is missing or is not a regular file.",
    },
  ]);
});

test("reports malformed and incomplete SKILL.md frontmatter", async (t) => {
  const cases = [
    {
      name: "missing opening delimiter",
      markdown: "name: invalid\ndescription: Missing delimiters.\n",
      expected: "skills/invalid/SKILL.md:1: SKILL.md must start with YAML frontmatter delimited by ---."
    },
    {
      name: "missing name",
      markdown: "---\ndescription: Missing name.\n---\n",
      expected: "skills/invalid/SKILL.md:1: Frontmatter field 'name' is required and must be a non-empty single-line string."
    },
    {
      name: "missing description",
      markdown: "---\nname: invalid\n---\n",
      expected: "skills/invalid/SKILL.md:1: Frontmatter field 'description' is required and must be a non-empty single-line string."
    },
    {
      name: "non-string description",
      markdown: "---\nname: invalid\ndescription: false\n---\n",
      expected: "skills/invalid/SKILL.md:3: Frontmatter field 'description' is required and must be a non-empty single-line string."
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const repositoryPath = await createRepository();
      await createSkill(repositoryPath, "invalid", fixture.markdown);

      const errors = await validateRepository(repositoryPath);

      assert.ok(
        errors.some(
          ({ path: errorPath, line, message }) =>
            `${errorPath}:${line}: ${message}` === fixture.expected,
        ),
      );
    });
  }
});

test("reports a frontmatter name that disagrees with its directory", async () => {
  const repositoryPath = await createRepository();
  await createSkill(
    repositoryPath,
    "directory-name",
    "---\nname: another-name\ndescription: Mismatched name.\n---\n",
  );

  const errors = await validateRepository(repositoryPath);

  assert.ok(
    errors.some(
      ({ path: errorPath, line, message }) =>
        errorPath === "skills/directory-name/SKILL.md" &&
        line === 2 &&
        message === "Frontmatter name 'another-name' must match directory name 'directory-name'.",
    ),
  );
});

test("reports missing and escaping relative links in recursive Markdown", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "linked");
  await mkdir(path.join(skillPath, "references"));
  await writeFile(
    path.join(skillPath, "references", "nested.md"),
    "[Missing](missing.md#section)\n[Escape](../../../outside.md?raw=1)\n",
  );

  const errors = await validateRepository(repositoryPath);

  assert.deepEqual(
    errors
      .filter(({ path: errorPath }) => errorPath.endsWith("nested.md"))
      .map(({ line, message }) => `${line}: ${message}`),
    [
      "1: Relative Markdown link target does not exist: missing.md#section",
      "2: Relative Markdown link escapes the skill directory: ../../../outside.md?raw=1",
    ],
  );
});

test("reports forbidden private and machine-local references recursively", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "public-skill");
  await mkdir(path.join(skillPath, "references"));
  await writeFile(
    path.join(skillPath, "references", "private.md"),
    [
      "Use precommit-review.",
      "Configure load_skills.",
      "Read /Users/example/private.txt.",
      "Visit https://wiki.yandex-team.ru/private.",
      "",
    ].join("\n"),
  );

  const errors = await validateRepository(repositoryPath);

  assert.deepEqual(
    errors
      .filter(({ path: errorPath }) => errorPath.endsWith("private.md"))
      .map(({ line, message }) => `${line}: ${message}`),
    [
      "1: Forbidden private dependency or machine-local reference: precommit-review",
      "2: Forbidden private dependency or machine-local reference: load_skills",
      "3: Forbidden private dependency or machine-local reference: /Users/",
      "4: Forbidden private dependency or machine-local reference: yandex-team",
    ],
  );
});

test("reports a forbidden reference in a bundled script", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "scripted");
  await mkdir(path.join(skillPath, "references", "scripts"), { recursive: true });
  await writeFile(
    path.join(skillPath, "references", "scripts", "private.mjs"),
    "export const publicValue = true;\nexport const privateDependency = 'load_skills';\n",
  );

  const errors = await validateRepository(repositoryPath);

  assert.deepEqual(errors, [
    {
      path: "skills/scripted/references/scripts/private.mjs",
      line: 2,
      message: "Forbidden private dependency or machine-local reference: load_skills",
    },
  ]);
});

test("CLI emits deterministic bounded path:line diagnostics and exits nonzero", async () => {
  const repositoryPath = await createRepository();
  const skillPath = await createSkill(repositoryPath, "invalid");
  await writeFile(
    path.join(skillPath, "NOTICE.md"),
    Array.from({ length: 60 }, () => "precommit-review").join("\n"),
  );

  const firstRun = spawnSync(process.execPath, [validatorPath, repositoryPath], {
    encoding: "utf8",
  });
  const secondRun = spawnSync(process.execPath, [validatorPath, repositoryPath], {
    encoding: "utf8",
  });

  assert.equal(firstRun.status, 1);
  assert.equal(firstRun.stderr, secondRun.stderr);
  const diagnostics = firstRun.stderr
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("skills/"));
  assert.equal(diagnostics.length, 50);
  assert.match(diagnostics[0], /^skills\/invalid\/NOTICE\.md:1: /);
  assert.match(diagnostics.at(-1), /^skills\/invalid\/NOTICE\.md:50: /);
  assert.match(firstRun.stderr, /Validation stopped after 50 errors\./);
});
