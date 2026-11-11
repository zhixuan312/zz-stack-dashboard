/**
 * What reached a page, for a Tier 2 table: the page's own files and every module they import, and the commits since the
 * baseline release that touched those files. It is the same import graph the related selection relies on, walked the
 * other way: a page's route to its modules, then commits to those modules. A module several pages share (the shell, the
 * tokens) is named once as shared, never under every page; and a page several commits reach carries a candidate list,
 * not a measurement — isolating a value to one commit is a manual before/after step, never a bisect here.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IMPORT = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

const readIf = (file: string): string | null => (fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null);

/** The file a specifier names, from the importing file: `@/x` under `src/`, a relative path beside it, with the extensions tried. */
function resolve(root: string, from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => path.join(base, `index${e}`))]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The page file of every static route under `app/`: a route group `(x)` adds no segment, a dynamic one is a detail route. */
export function routeFiles(root: string): Map<string, string> {
  const app = fs.existsSync(path.join(root, 'app')) ? path.join(root, 'app') : path.join(root, 'src', 'app');
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name !== 'page.tsx' && entry.name !== 'page.ts' && entry.name !== 'page.jsx' && entry.name !== 'page.js') continue;
      const segments = path.relative(app, dir).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s));
      if (segments.some((s) => s.startsWith('['))) continue;
      out.set(`/${segments.join('/')}`.replace(/\/$/, '') || '/', full);
    }
  };
  walk(app);
  return out;
}

/** The modules a page reaches through its imports, the page's own file included, as repo-relative paths. */
export function pageModules(root: string, pageFile: string): string[] {
  const seen = new Set<string>();
  const queue = [pageFile];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readIf(file);
    if (text === null) continue;
    for (const match of text.matchAll(IMPORT)) {
      const resolved = resolve(root, file, match[1] ?? match[2] ?? '');
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen].map((f) => path.relative(root, f).split(path.sep).join('/')).sort();
}

export type PageGraph = {
  pages: string[];
  /** Page → the modules it reaches (repo-relative). */
  modules: Map<string, string[]>;
  /** A module reached by more than one page: the shell, the tokens. */
  shared: Set<string>;
};

export function pageGraph(root: string): PageGraph {
  const pages = routeFiles(root);
  const modules = new Map<string, string[]>();
  const reachedBy = new Map<string, string[]>();
  for (const [route, file] of pages) {
    const list = pageModules(root, file);
    modules.set(route, list);
    for (const m of list) reachedBy.set(m, [...(reachedBy.get(m) ?? []), route]);
  }
  const shared = new Set([...reachedBy].filter(([, routes]) => routes.length > 1).map(([m]) => m));
  return { pages: [...pages.keys()].sort(), modules, shared };
}

export type Commit = { sha: string; subject: string; files: string[] };

/** The commits between `since` and HEAD that touch any of `files` (a file gone since is still a commit that touched it). */
export function commitsTouching(root: string, since: string, files: string[]): Commit[] {
  if (!files.length) return [];
  // A NUL before each commit's header separates records: a blank line already separates the header from its files.
  const out = execFileSync('git', ['log', `${since}..HEAD`, '--format=%x00%H%x09%s', '--name-only', '--', ...files], { cwd: root, encoding: 'utf8' });
  const commits: Commit[] = [];
  for (const chunk of out.split('\0').filter((c) => c.trim())) {
    const [head, ...rest] = chunk.trim().split('\n');
    const [sha, ...subject] = (head ?? '').split('\t');
    if (!sha || !subject.length) continue;
    commits.push({ sha, subject: subject.join('\t'), files: rest.map((l) => l.trim()).filter(Boolean) });
  }
  return commits;
}

/** The pages a commit reaches: those whose module set includes one of its files. */
export function pagesReached(graph: PageGraph, commit: Commit): string[] {
  return graph.pages.filter((p) => (graph.modules.get(p) ?? []).some((m) => commit.files.includes(m)));
}

export type ChangeRow = { page: string; check: string; unit: string; delta: number; shared: boolean; note: string };

/**
 * Per commit since the baseline, the pages it reaches and the deltas measured there. A row is the page's delta, not the
 * commit's share of it — two commits reaching one page both show it, and the section says so rather than pretending to add.
 */
export function byChange(graph: PageGraph, commits: Commit[], deltas: { page: string; check: string; unit: string; delta: number }[]): { sha: string; subject: string; pages: { page: string; shared: boolean; note: string; values: { check: string; unit: string; delta: number }[] }[] }[] {
  return commits.map((c) => {
    const reached = pagesReached(graph, c);
    return {
      sha: c.sha.slice(0, 8),
      subject: c.subject,
      pages: reached.map((page) => ({
        page,
        shared: reached.length > 1,
        note: 'page delta, not this commit\'s share',
        values: deltas.filter((d) => d.page === page).map(({ check, unit, delta }) => ({ check, unit, delta })),
      })).filter((p) => p.values.length || p.shared),
    };
  }).filter((c) => c.pages.length);
}
