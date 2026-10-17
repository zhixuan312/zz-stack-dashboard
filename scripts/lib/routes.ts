/** The routes a browser check visits: every static page under app/, so a new page is checked without being listed. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** Where the routes live: `app/`, or `src/app/` in a project that keeps its app under src. */
export const APP_DIR = fs.existsSync(path.join(ROOT, 'app')) ? 'app' : 'src/app';

/**
 * Whether a page specification under the app folder is one of the console's or an embed view's: the pages that share a
 * context with the agents. The console is whatever route group the project keeps at the top of its app folder,
 * `(dashboard)` in the template and any other name in a product that had its own.
 */
export function agentPageSpec(file: string, appDir = APP_DIR): boolean {
  const rest = file.startsWith(`${appDir}/`) ? file.slice(appDir.length + 1) : null;
  return rest !== null && /^(\([^/)]+\)|embed)\//.test(rest);
}

/**
 * The page a specification under the app folder describes, as its view tool's `page` names it: route groups dropped,
 * dynamic segments kept. `app/(dashboard)/(home)/README.md` is `/`, `app/(dashboard)/customers/[id]/README.md` is
 * `/customers/[id]`.
 */
export function specRoute(file: string, appDir = APP_DIR): string {
  const segments = path.posix.dirname(file).slice(appDir.length + 1).split('/');
  return '/' + segments.filter((s) => s && !/^\(.*\)$/.test(s)).join('/');
}

/** Every page specification an agent shares a context with (`agentPageSpec`), with the page it describes, in path order. */
export function pageSpecs(): { file: string; route: string }[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const n of fs.readdirSync(path.join(ROOT, dir))) {
      const p = `${dir}/${n}`;
      if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p);
      else if (n === 'README.md' && agentPageSpec(p)) out.push(p);
    }
  };
  walk(APP_DIR);
  return out.sort().map((file) => ({ file, route: specRoute(file) }));
}

/** One question a page specification lists for its agent: what a person asks, and what the prepared query is asked. */
export type AgentQuestion = { question: string; asked: string };

/**
 * What a page specification says under `## Agents` → `### What the agent does here` (FR-42): the line
 * `Protagonist: <name>.`, and the list items `- "<question>" — <what the prepared query is asked>`. A list item in
 * another form is kept in `stray`, so a rule can name it. Null when the specification has no such section.
 */
export function agentSection(md: string): { protagonist: string | null; questions: AgentQuestion[]; stray: string[] } | null {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trimEnd() === '### What the agent does here');
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,3} /.test(l));
  const body = lines.slice(start + 1, end < 0 ? undefined : end);
  const protagonist = body.map((l) => /^Protagonist: (.+)\.$/.exec(l.trim())?.[1]).find((p) => p !== undefined) ?? null;
  const questions: AgentQuestion[] = [];
  const stray: string[] = [];
  for (const line of body.filter((l) => l.startsWith('- '))) {
    const m = /^- "(.+?)" — (.+)$/.exec(line.trimEnd());
    if (m) questions.push({ question: m[1], asked: m[2] });
    else stray.push(line);
  }
  return { protagonist, questions, stray };
}

/**
 * Each view tool's `name` and `page` as a source declares them (`src/views/tools.ts` when none is given): the keys of
 * each `defineViewTool({ ... })` object itself, never a `name` or `page` inside its code, such as the `page` of
 * Customers' filter. Read as text, because a script runs under plain node and cannot load the product's views. Null
 * when the file does not exist.
 */
export function viewToolPages(source?: string): { name: string; page: string }[] | null {
  if (source === undefined) {
    const file = path.join(ROOT, 'src/views/tools.ts');
    if (!fs.existsSync(file)) return null;
    source = fs.readFileSync(file, 'utf8');
  }
  const src = source;
  const out: { name: string; page: string }[] = [];
  for (let i = 0; i < src.length;) {
    const past = skipLiteral(src, i);
    if (past !== i) { i = past; continue; }
    CALL.lastIndex = i;
    const call = CALL.exec(src);
    if (!call || /[\w$]/.test(src[i - 1] ?? '')) { i++; continue; }
    const open = i + call[0].length - 1;
    const close = closeOf(src, open);
    const keys: Record<string, string> = {};
    // Walk the object's own level: a nested object, array, call or function body is passed over whole, so only the
    // object's keys are read, each one right after its `{` or a `,`.
    let prev = '{';
    for (let k = open + 1; k < close;) {
      const lit = skipLiteral(src, k);
      if (lit !== k) { k = lit; continue; }
      const c = src[k];
      if (/\s/.test(c)) { k++; continue; }
      if (prev === '{' || prev === ',') {
        const key = /(name|page)\s*:\s*(['"])((?:\\.|(?!\2)[^\\\n])*)\2/y;
        key.lastIndex = k;
        const m = key.exec(src);
        if (m && !(m[1] in keys)) keys[m[1]] = m[3];
      }
      if ('{(['.includes(c)) { k = closeOf(src, k) + 1; prev = '}'; continue; }
      prev = c;
      k++;
    }
    if (keys.name && keys.page) out.push({ name: keys.name, page: keys.page });
    i = close + 1;
  }
  return out;
}

/** A call of `defineViewTool` with an object, up to the object's `{`. */
const CALL = /defineViewTool\s*(?:<[^>]*>)?\s*\(\s*\{/y;

/** The index of the bracket that closes the `{`, `(` or `[` at `open`, passing over strings, comments and regular expressions. */
function closeOf(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length;) {
    const past = skipLiteral(src, i);
    if (past !== i) { i = past; continue; }
    const c = src[i];
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c) && --depth === 0) return i;
    i++;
  }
  return src.length;
}

/**
 * The index just past the string, template, comment or regular expression that starts at `i`, or `i` when none does.
 * A `/` opens a regular expression where a value is expected: after an operator, an opening bracket, a comma or
 * `return`.
 */
function skipLiteral(src: string, i: number): number {
  const c = src[i], next = src[i + 1];
  if (c === '/' && next === '/') { const e = src.indexOf('\n', i); return e < 0 ? src.length : e; }
  if (c === '/' && next === '*') { const e = src.indexOf('*/', i + 2); return e < 0 ? src.length : e + 2; }
  if (c === "'" || c === '"') {
    let j = i + 1;
    while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (c === '`') {
    let j = i + 1;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') j += 2;
      else if (src[j] === '$' && src[j + 1] === '{') j = closeOf(src, j + 1) + 1;
      else j++;
    }
    return j + 1;
  }
  const before = src.slice(Math.max(0, i - 20), i);
  if (c === '/' && (/(?:[(,=:[!&|?{};+\-*%<>~^]|\breturn)\s*$/.test(before) || (i < 20 && !before.trim()))) {
    let j = i + 1, inClass = false;
    while (j < src.length && src[j] !== '\n') {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '[') inClass = true;
      else if (src[j] === ']') inClass = false;
      else if (src[j] === '/' && !inClass) {
        let flags = j + 1;
        while (/[a-z]/.test(src[flags] ?? '')) flags++;
        return flags;
      }
      j++;
    }
  }
  return i;
}

/** Every static page, as a route: route groups dropped, dynamic segments skipped (verify.config.ts lists them in detailRoutes). */
export function discover(): string[] {
  const out: string[] = [];
  const walk = (dir: string, route: string[]) => {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      if (fs.statSync(p).isDirectory()) {
        // Dynamic segments come from detailRoutes; private folders and API routes are not pages.
        if (n.startsWith('[') || n.startsWith('_') || n === 'api' || (route[0] === 'system' && n === 'preview')) continue;
        walk(p, /^\(.*\)$/.test(n) ? route : [...route, n]);
      } else if (n === 'page.tsx') out.push('/' + route.join('/'));
    }
  };
  walk(path.join(ROOT, APP_DIR), []);
  if (out.includes('/system') && fs.existsSync(path.join(ROOT, 'src/components/ui/button/README.md'))) out.push('/system/components/button');
  out.push('/this-page-does-not-exist');
  return [...new Set(out)].sort();
}

/**
 * The rail's routes, from `nav` in `src/app.config.ts`, read through its own type: same-origin hrefs in navigation order,
 * each once. `landing` is `/` when the rail has it, else the first rail route. A `nav` that cannot be read throws, with
 * the reason, so a caller can fail or report `not run`.
 */
export async function railRoutes(): Promise<{ routes: string[]; landing: string }> {
  type Nav = { items?: { href?: unknown }[] }[];
  let nav: unknown;
  try {
    nav = ((await import(pathToFileURL(path.join(ROOT, 'src/app.config.ts')).href)) as { nav?: unknown }).nav;
  } catch (e) {
    throw new Error(`src/app.config.ts could not be read: ${(e as Error).message.split('\n')[0]}`);
  }
  if (!Array.isArray(nav)) throw new Error('src/app.config.ts has no `nav` array of groups');
  const hrefs = (nav as Nav).flatMap((g) => (Array.isArray(g?.items) ? g.items.map((i) => i?.href) : []));
  const routes = [...new Set(hrefs.filter((h): h is string => typeof h === 'string' && h.startsWith('/') && !h.startsWith('//')))];
  if (!routes.length) throw new Error('`nav` in src/app.config.ts has no same-origin route');
  return { routes, landing: routes.includes('/') ? '/' : routes[0] };
}
