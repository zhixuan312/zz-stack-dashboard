/**
 * Which large browser-fixture tests (tests/deep-*) a change reaches. They drive Chrome against fixture apps, so they run
 * only when the change can alter what they exercise.
 *
 * Decision, in order:
 * - a change under `scripts/`, `journeys/` or `tests/deep-` is the fixtures' own machinery: every deep test runs;
 * - otherwise a deep test runs when its import graph contains a changed file (`deepReach`, an import walk below).
 *
 * The listing is an import walk, not `vitest related` (which runs what it selects) and not `vitest list --changed` (which
 * reads the working tree rather than a committed range).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'];
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

/** The files a deep test run owes for `changed`: all of them, or the ones `reach` lists, sorted. */
export function deepPlan(changed: string[], reach: (files: string[]) => string[]): { all: boolean; files: string[] } {
  if (changed.some((f) => /^(scripts|journeys)\//.test(f) || f.startsWith('tests/deep-'))) return { all: true, files: [] };
  return { all: false, files: [...reach(changed)].sort() };
}

/** The project file a specifier names from `from`, or null for a package or an unresolvable path. */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? path.join(ROOT, 'src', specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(ROOT, path.dirname(from), specifier) : null;
  if (!base) return null;
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return path.relative(ROOT, file);
  }
  return null;
}

/** Every project file a module imports, transitively, itself included. */
function graphOf(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    let text = '';
    try { text = fs.readFileSync(path.join(ROOT, file), 'utf8'); } catch { continue; }
    for (const m of text.matchAll(IMPORT)) {
      const next = resolveImport(file, m[1]!);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

/** Every deep test file in the project, sorted. */
export const deepFiles = (): string[] => fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => /^deep-[^/]*\.test\.tsx?$/.test(f)).sort().map((f) => `tests/${f}`);

/** The deep test files whose import graph contains a changed file. */
export function deepReach(changed: string[]): string[] {
  const set = new Set(changed);
  return deepFiles().filter((t) => [...graphOf(t)].some((f) => set.has(f)));
}

/** The files of part `i` of `n`: every n-th file starting at `i` (1-based), by sorted name. */
export const deepPart = (files: string[], i: number, n: number): string[] => [...files].sort().filter((_, k) => k % n === i - 1);
