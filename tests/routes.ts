/**
 * The app's routes as Next reads them from `app/`, for the suites that walk every page.
 *
 * One module because the walk is the route table's contract, not a test's: route groups `(x)` are dropped from the
 * address, `_` and `@` folders are not routes, and the feature a page asks is the one its gate names. Copies of the walk
 * had drifted on the last of these (one read a feature with a digit and two refused it), so a page could pass one suite
 * and fail another for the same source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FEATURES, type FeatureId } from '@/data/features';

export const APP = path.resolve(import.meta.dirname, '..', 'app');
export const DASH = path.join(APP, '(dash)');
/** The catch-all that answers every address no page does. */
export const CATCH_ALL = path.join(DASH, '[...missing]');

/** The feature a page's gate asks, as its source names it. */
const GATE = /\bgate\('([\w-]+)'\)/;

/** A page under `app/(dash)`: its file from there, its folder, its route with groups dropped, and its gate's feature. */
export type DashPage = { file: string; dir: string; route: string; feature: FeatureId };

/** Every page under `app/(dash)`, the catch-all among them, by file. A page with no gate, or one naming no feature, throws. */
export function dashPages(): DashPage[] {
  return (fs.readdirSync(DASH, { recursive: true }) as string[])
    .filter((f) => path.basename(f) === 'page.tsx').sort()
    .map((file) => {
      const asked = GATE.exec(fs.readFileSync(path.join(DASH, file), 'utf8'))?.[1];
      if (!asked || !Object.hasOwn(FEATURES, asked)) throw new Error(`app/(dash)/${file} opens with no gate on a feature`);
      const dir = path.join(DASH, path.dirname(file));
      const segments = path.dirname(file).split(path.sep).filter((s) => s !== '.' && !/^\(.*\)$/.test(s));
      return { file, dir, route: `/${segments.join('/')}`, feature: asked as FeatureId };
    });
}

/** Every route the app serves, as Next names it: each page's, and with `handlers` each route handler's too. */
export function appRoutes(handlers = false, dir = APP, segments: string[] = []): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !/^[_@]/.test(entry.name)) {
      out.push(...appRoutes(handlers, path.join(dir, entry.name), /^\(.*\)$/.test(entry.name) ? segments : [...segments, entry.name]));
    }
    if (entry.name === 'page.tsx' || (handlers && entry.name === 'route.ts')) out.push(`/${segments.join('/')}`);
  }
  return [...new Set(out)];
}
