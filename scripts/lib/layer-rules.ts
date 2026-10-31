/**
 * The four-layer rules that scan a whole folder, and the source helpers they share with `scripts/check.ts`.
 *
 * Two rules live here — `presentation does not read` and `no direct query` — because `scripts/check.ts` is a managed
 * file that has to stay under the line ceiling a project may enforce over its own sources. The helpers the check and
 * these scans both need are here for the same reason: a helper declared inside the check's own block cannot be imported
 * by anything. Nothing here imports `scripts/check.ts`; the dependency runs one way, the check into this module.
 *
 * Each rule is a pure scan: it reads the tree it is given and answers the violations it finds. It does not decide what
 * an escape is — `scripts/check.ts` reads the offending line, prints a stated `allow-<rule>: <reason>` and keeps the
 * run passing, exactly as it does for the rules declared beside it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { importTarget } from './aliases.ts';

/** The project's root and its import aliases, so a scan resolves an import the way TypeScript does. */
export type LayerTree = { root: string; aliases: [string, string][] };
/** One violation, before its escape: the check supplies the rule's name and prints the escape. */
export type RuleProblem = { file: string; line: number; message: string };

// ── Reading source ───────────────────────────────────────────────────────────────────────────────────
/** Comments blanked, not removed, so a scan reads code and a line number is still the file's. */
export function blankedText(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const VALUE = /\b(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT = /\bimport\s*(?:\(\s*)?['"]([^'"]+)['"]/g;

/** Every specifier a source takes by value, with where it sits. A type-only import is erased before anything runs, so it is not one. */
export function valueImports(src: string): { spec: string; at: number }[] {
  const out: { spec: string; at: number }[] = [];
  for (const m of src.matchAll(VALUE)) {
    const names = /^\{([^}]*)\}$/.exec(m[2].trim())?.[1].split(',').map((n) => n.trim()).filter(Boolean);
    if (m[1] || names?.every((n) => /^type\s/.test(n))) continue;
    out.push({ spec: m[3], at: m.index! + m[0].lastIndexOf(m[3]) });
  }
  for (const m of src.matchAll(SIDE_EFFECT)) out.push({ spec: m[1], at: m.index! + m[0].lastIndexOf(m[1]) });
  return out;
}

/** The project file an import specifier names, with the extension resolved, or null for a package or a missing module. */
export function resolveSpec(from: string, spec: string, aliases: [string, string][], root: string): string | null {
  const base = importTarget(from, spec, aliases);
  if (!base) return null;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) => /\.tsx?$/.test(c) && fs.existsSync(path.join(root, c)) && fs.statSync(path.join(root, c)).isFile()) ?? null;
}

const lineOf = (src: string, at: number) => src.slice(0, at).split('\n').length;

/** Every file under `dir` whose name matches `ext`, as paths relative to `root`; a missing directory holds none. */
export function walk(root: string, dir: string, ext: RegExp, out: string[] = []): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const n of fs.readdirSync(abs)) {
    const p = path.join(dir, n);
    if (fs.statSync(path.join(root, p)).isDirectory()) walk(root, p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}

/** A source file as a scan reads it: comment-blanked. The escape's raw line is read by scripts/check.ts itself. */
const sourceOf = (tree: LayerTree, file: string) => blankedText(fs.readFileSync(path.join(tree.root, file), 'utf8'));

// ── presentation does not read ───────────────────────────────────────────────────────────────────────
/** The five vocabulary modules what is drawn may take a value from, by name. */
export const VOCABULARY = ['roles.ts', 'features.ts', 'sample.ts', 'request-methods.ts', 'live-actions.ts'];

/**
 * A value import resolving under `src/data/` from `src/views/**` or `src/components/**`, naming any module other than
 * the five vocabulary modules. A type import is erased before anything runs, so it is not a read; `app/` is the
 * entry that assembles an answer rather than presentation, so it is not scanned. Comments are blanked first, so a
 * documented import in prose is not a violation.
 */
export function presentationDoesNotRead(tree: LayerTree): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const file of ['src/views', 'src/components'].flatMap((dir) => walk(tree.root, dir, /\.tsx?$/))) {
    const src = sourceOf(tree, file);
    for (const { spec, at } of valueImports(src)) {
      const target = resolveSpec(file, spec, tree.aliases, tree.root);
      if (!target || !target.startsWith('src/data/') || VOCABULARY.includes(path.posix.basename(target))) continue;
      // The path as the import writes it: the extension a resolution added is not what the reader is looking for.
      problems.push({ file, line: lineOf(src, at), message: `imports ${spec} from ${target.replace(/\.tsx?$/, '')}; presentation does not read — it takes only a type or one of the five vocabulary modules (${VOCABULARY.join(', ')}) from @/data` });
    }
  }
  return problems;
}

// ── no direct query ──────────────────────────────────────────────────────────────────────────────────
/**
 * A `.query(` call on a code line of `app/**`, `src/logic/**`, `src/views/**` or `src/lib/**`: a page, a view, a logic
 * module or a lib module reads through `read()`, `readAll()` or `aggregate()`, so the caller's access applies. Comments
 * are blanked first, so a `.query(` a document quotes in prose is not a violation. The sites that must query
 * directly state it on the call's own line as `allow-no-direct-query: <reason>`, which `scripts/check.ts` prints as an
 * escape: a list of sites by line number here would point at whatever a comment added above them moved the call under,
 * and its own count was wrong the moment a line moved. The other two sites live in `src/data/access.ts`, which this
 * rule does not govern.
 */
export function noDirectQuery(tree: LayerTree): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const file of ['app', 'src/logic', 'src/views', 'src/lib'].flatMap((dir) => walk(tree.root, dir, /\.tsx?$/))) {
    sourceOf(tree, file).split('\n').forEach((text, i) => {
      const call = text.match(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.query\s*\(/);
      if (!call) return;
      problems.push({ file, line: i + 1, message: `calls ${call[1]}.query( directly; no direct query — read it through read(), readAll() or aggregate() from @/data/read, so the caller's access applies` });
    });
  }
  return problems;
}
