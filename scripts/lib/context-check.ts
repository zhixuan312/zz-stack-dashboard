/**
 * Pure checks for the agent-facing context a project keeps: the product brief (`docs/brief.md`) and the references its
 * instruction documents make to files and package scripts. No I/O here: the caller reads the files and says what exists.
 */
import path from 'node:path';
import { BRIEF_GUIDANCE } from '../../src/lib/assistant/prompt.ts';

/** The headings a brief must have, once each, in the order the template writes them. */
const REQUIRED = ['Product', 'Users', 'Data', 'Decisions', 'Glossary'] as const;

/**
 * Check a brief. A required `## ` heading that is missing or appears twice is an error; a section whose only non-blank
 * line is its own guidance line (the template, untouched) is a warning, because it has not been written yet.
 */
export function checkBrief(text: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sections = new Map<string, string[][]>();
  let current: string[] | null = null;
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^## (.+?)\s*$/.exec(line);
    if (heading) {
      current = [];
      sections.set(heading[1], [...(sections.get(heading[1]) ?? []), current]);
    } else if (!fenced && /^#{1,2} /.test(line)) current = null;
    else current?.push(line);
  }
  for (const name of REQUIRED) {
    const found = sections.get(name) ?? [];
    if (found.length === 0) errors.push(`missing required heading "## ${name}"`);
    else if (found.length > 1) errors.push(`heading "## ${name}" appears ${found.length} times`);
    else {
      const body = found[0].map((l) => l.trim()).filter(Boolean);
      if (body.length === 0 || (body.length === 1 && body[0] === BRIEF_GUIDANCE[name])) warnings.push(`"## ${name}" is still the template guidance; write it`);
    }
  }
  return { errors, warnings };
}

/** A path reference starts with one of these, after an optional `required:`, `optional:` or `example:`. */
const PATH_ROOTS = ['.agents/', '.claude/', 'src/', 'app/', 'scripts/', 'docs/', '.meridian/', 'tokens/', 'tests/', 'references/'];

/** `pnpm <name>`, `pnpm run <name>`, `npm run <name>`, `yarn <name>` or `bun run <name>`, then nothing, ` -- ...` or flags. */
const SCRIPT = /^(?:pnpm run|pnpm|npm run|yarn|bun run) ([\w:.-]+)(?: --(?: .*)?| -.*)?$/;

/**
 * Check what documents point at. Only inline code spans count, and fenced code is skipped. A path reference must exist,
 * unless it is `optional:` or `example:`; a script reference must be in `scripts`. Globs, placeholders, URLs,
 * `node_modules/` paths and plain words are not references. `references/...` resolves against the document's own folder,
 * everything else from the repository root. `docs[i].file` is repository-relative and `firstLine` (default 1) is the line
 * of `text`'s first line in it. Returns one `<file>:<line>: <what is missing>` per problem.
 */
export function scanReferences(
  docs: { file: string; text: string; firstLine?: number }[],
  exists: (path: string) => boolean,
  scripts: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  for (const { file, text, firstLine = 1 } of docs) {
    let fenced = false;
    text.split('\n').forEach((line, i) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      for (const [, span] of line.matchAll(/`([^`]+)`/g)) {
        const at = `${file}:${firstLine + i}`;
        const prefix = /^(required|optional|example):/.exec(span)?.[1];
        if (prefix === 'example') continue;
        const ref = prefix ? span.slice(prefix.length + 1) : span;
        const script = SCRIPT.exec(ref);
        if (script) {
          if (!scripts.has(script[1])) problems.push(`${at}: package script "${script[1]}" is not in package.json`);
          continue;
        }
        if (!PATH_ROOTS.some((r) => ref.startsWith(r)) || /[*?<>{} ]/.test(ref)) continue;
        if (prefix === 'optional') continue;
        const target = ref.startsWith('references/') ? path.posix.join(path.posix.dirname(file), ref) : ref;
        const asGiven = ref.endsWith('/') && !target.endsWith('/') ? `${target}/` : target;
        if (!exists(asGiven)) problems.push(`${at}: path "${asGiven}" does not exist`);
      }
    });
  }
  return problems;
}
