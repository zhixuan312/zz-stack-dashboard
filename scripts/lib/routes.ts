/** The routes a browser check visits: every static page under app/, so a new page is checked without being listed. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** Where the routes live: `app/`, or `src/app/` in a project that keeps its app under src. */
export const APP_DIR = fs.existsSync(path.join(ROOT, 'app')) ? 'app' : 'src/app';

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
