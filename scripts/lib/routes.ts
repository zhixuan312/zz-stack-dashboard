/** The routes a browser check visits: every static page under app/, so a new page is checked without being listed. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** Where the routes live: `app/`, or `src/app/` in a project that keeps its app under src. */
export const APP_DIR = fs.existsSync(path.join(ROOT, 'app')) ? 'app' : 'src/app';

/** Every static page, as a route: route groups dropped, dynamic segments skipped (pass them with --extra). */
export function discover(): string[] {
  const out: string[] = [];
  const walk = (dir: string, route: string[]) => {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      if (fs.statSync(p).isDirectory()) {
        // Dynamic segments come from --extra; private folders and API routes are not pages.
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
