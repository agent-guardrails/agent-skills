import { report } from "./validation-utils.mjs";

function parseQuotedScalar(value) {
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" ? parsed : undefined;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return undefined;
      }
      throw error;
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) {
      return undefined;
    }
    return value.slice(1, -1).replaceAll("''", "'");
  }
  const commentIndex = value.search(/\s+#/u);
  const plainValue = (commentIndex === -1 ? value : value.slice(0, commentIndex)).trim();
  const typedScalar = /^(?:~|null|true|false|[-+]?(?:0|[1-9][0-9_]*)(?:\.[0-9_]*)?(?:e[-+]?[0-9]+)?|[-+]?\.inf|\.nan)$/iu;
  if (/^[\[{]|^[>|][+-]?$/u.test(plainValue) || typedScalar.test(plainValue)) {
    return undefined;
  }
  return plainValue;
}

function parseFrontmatter(markdown, context) {
  const lines = markdown.split(/\r?\n/u);
  if (lines[0] !== "---") {
    report(context.errors, {
      path: context.skillFile,
      line: 1,
      message: "SKILL.md must start with YAML frontmatter delimited by ---.",
    });
    return undefined;
  }
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    report(context.errors, {
      path: context.skillFile,
      line: 1,
      message: "SKILL.md frontmatter is missing its closing --- delimiter.",
    });
    return undefined;
  }

  const fields = new Map();
  for (let index = 1; index < closingIndex; index += 1) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):(?:[ \t]*(.*))?$/u.exec(lines[index]);
    if (match === null) {
      continue;
    }
    const [, key, rawValue = ""] = match;
    if (fields.has(key)) {
      report(context.errors, {
        path: context.skillFile,
        line: index + 1,
        message: `Frontmatter field '${key}' must not be repeated.`,
      });
      continue;
    }
    fields.set(key, { value: parseQuotedScalar(rawValue.trim()), line: index + 1 });
  }
  return fields;
}

export function validateFrontmatter(markdown, context) {
  const fields = parseFrontmatter(markdown, context);
  if (fields === undefined) {
    return;
  }
  for (const fieldName of ["name", "description"]) {
    const field = fields.get(fieldName);
    if (field?.value === undefined || field.value.trim() === "") {
      report(context.errors, {
        path: context.skillFile,
        line: field?.line ?? 1,
        message: `Frontmatter field '${fieldName}' is required and must be a non-empty single-line string.`,
      });
    }
  }
  const name = fields.get("name");
  if (name?.value !== undefined && name.value !== context.skillName) {
    report(context.errors, {
      path: context.skillFile,
      line: name.line,
      message: `Frontmatter name '${name.value}' must match directory name '${context.skillName}'.`,
    });
  }
}
