import { isMap, LineCounter, parseDocument } from "yaml";

import { report } from "./validation-utils.mjs";

function parseFrontmatter(markdown, context) {
  const source = markdown.startsWith("\uFEFF") ? markdown.slice(1) : markdown;
  const lines = source.split(/\r?\n/u);
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

  const lineCounter = new LineCounter();
  const document = parseDocument(lines.slice(1, closingIndex).join("\n"), {
    lineCounter,
    stringKeys: true,
  });
  if (document.errors.length > 0) {
    for (const error of document.errors) {
      report(context.errors, {
        path: context.skillFile,
        line: (error.linePos?.[0].line ?? 0) + 1,
        message: `Frontmatter contains invalid YAML (${error.code}).`,
      });
    }
    return undefined;
  }
  if (document.contents !== null && !isMap(document.contents)) {
    report(context.errors, {
      path: context.skillFile,
      line: 2,
      message: "Frontmatter must be a YAML mapping.",
    });
    return undefined;
  }

  return {
    document,
    lineCounter,
    values: document.contents === null ? {} : document.toJS(),
  };
}

function fieldLine(parsed, fieldName) {
  const node = parsed.document.get(fieldName, true);
  if (node === undefined || node === null || node.range === undefined) {
    return 1;
  }
  return parsed.lineCounter.linePos(node.range[0]).line + 1;
}

export function validateFrontmatter(markdown, context) {
  const parsed = parseFrontmatter(markdown, context);
  if (parsed === undefined) {
    return;
  }
  for (const fieldName of ["name", "description"]) {
    const value = parsed.values[fieldName];
    if (typeof value !== "string" || value.trim() === "") {
      report(context.errors, {
        path: context.skillFile,
        line: fieldLine(parsed, fieldName),
        message: `Frontmatter field '${fieldName}' is required and must be a non-empty string.`,
      });
    }
  }
  const name = parsed.values.name;
  if (typeof name === "string" && name.trim() !== "" && name !== context.skillName) {
    report(context.errors, {
      path: context.skillFile,
      line: fieldLine(parsed, "name"),
      message: `Frontmatter name '${name}' must match directory name '${context.skillName}'.`,
    });
  }
}
