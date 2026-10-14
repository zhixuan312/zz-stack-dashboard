/**
 * Fail a production build whose routes are not all static or partial: every non-API route must prerender, with its
 * request-dependent parts streamed behind boundaries, unless the product declares the route in
 * `requestDependentRoutes` (scripts/verify.config.ts) with the reason it cannot.
 *
 *   node scripts/route-policy.ts
 *
 * It reads the build's own manifests in the configured `distDir`: every app route in app-path-routes-manifest.json, and
 * the prerendered ones in prerender-manifest.json, where `renderingMode` says STATIC or PARTIALLY_STATIC (a partial
 * prerender). A route in the first and absent from the second is dynamic. It also fails a partial route whose shell for a
 * parameter the build did not know is an empty file. `pnpm verify` runs it right after its production build.
 */
import fs from 'node:fs';
import path from 'node:path';

import { distDirOf } from './lib/next-config.ts';
import config from './verify.config.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

export type RouteKind = 'static' | 'partial' | 'dynamic';
export type Declared = { path: string; reason: string };

/** The non-API routes that are dynamic and not declared. Throws on a declaration without a reason, or for a route the build does not have. */
export function offenders(routes: { path: string; kind: RouteKind }[], allowed: Declared[]): string[] {
  const known = new Set(routes.map((r) => r.path));
  for (const a of allowed) {
    if (!a.reason.trim()) throw new Error(`requestDependentRoutes: ${a.path} has no reason; say why it cannot be prerendered`);
    if (!known.has(a.path)) throw new Error(`requestDependentRoutes: ${a.path} is not a route of this build`);
  }
  const declared = new Set(allowed.map((a) => a.path));
  return routes.filter((r) => r.kind === 'dynamic' && !r.path.startsWith('/api/') && !declared.has(r.path)).map((r) => r.path);
}

/**
 * The partial routes whose prerendered shell is empty: a route with a parameter the build did not know, for which
 * nothing at all was prerendered. Such a route is counted as partial and behaves as dynamic, since every request waits
 * for the whole page. It means something above the page reads the address or the request outside a Suspense boundary
 * (a `usePathname()` at the top of a shell did it here: the build's shell for `/requests/[id]` was a file of 0 bytes).
 */
export function emptyShells(shells: { path: string; bytes: number | null }[]): string[] {
  return shells.filter((s) => s.bytes === 0).map((s) => s.path);
}

/** The prerendered shell of every route with a parameter the build did not know, and its size (null when the build wrote none). */
function shellsOf(dist: string): { path: string; bytes: number | null }[] {
  const prerender: { dynamicRoutes: Record<string, { renderingMode?: string }> } = JSON.parse(fs.readFileSync(path.join(dist, 'prerender-manifest.json'), 'utf8'));
  return Object.entries(prerender.dynamicRoutes).filter(([, r]) => r.renderingMode === 'PARTIALLY_STATIC').map(([p]) => {
    const file = path.join(dist, 'server/app', `${p}.html`);
    return { path: p, bytes: fs.existsSync(file) ? fs.statSync(file).size : null };
  });
}

/** Every app route of the build, and how it is served. */
function routesOf(dist: string): { path: string; kind: RouteKind }[] {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dist, f), 'utf8'));
  const app: Record<string, string> = read('app-path-routes-manifest.json');
  const prerender: { routes: Record<string, { renderingMode?: string }>; dynamicRoutes: Record<string, { renderingMode?: string }> } = read('prerender-manifest.json');
  const mode = (p: string) => (prerender.routes[p] ?? prerender.dynamicRoutes[p])?.renderingMode;
  return Object.values(app).map((p) => ({ path: p, kind: mode(p) === 'STATIC' ? 'static' : mode(p) === 'PARTIALLY_STATIC' ? 'partial' : 'dynamic' }));
}

if (import.meta.main) {
  const dist = path.join(ROOT, await distDirOf(ROOT));
  if (!fs.existsSync(path.join(dist, 'prerender-manifest.json'))) {
    console.error(`route-policy: no production build in ${path.relative(ROOT, dist)}; run next build first`);
    process.exit(1);
  }
  let bad: string[];
  const routes = routesOf(dist);
  try {
    // verify.config.ts is the team's, so a product set up by an earlier release has a config type without the field.
    bad = offenders(routes, (config as { requestDependentRoutes?: Declared[] }).requestDependentRoutes ?? []);
  } catch (e) {
    console.error(`route-policy: ${(e as Error).message}`);
    process.exit(1);
  }
  for (const p of bad) console.log(`dynamic route ${p}: prerender it, or declare it in requestDependentRoutes with a reason`);
  const empty = emptyShells(shellsOf(dist));
  for (const p of empty) console.log(`empty shell ${p}: nothing is prerendered for a parameter the build did not know, so every such request waits for the whole page; something above the page reads the address or the request outside a Suspense boundary`);
  const count = (k: RouteKind) => routes.filter((r) => r.kind === k && !r.path.startsWith('/api/')).length;
  console.log(`route-policy: ${count('static')} static, ${count('partial')} partial, ${bad.length} dynamic of ${routes.filter((r) => !r.path.startsWith('/api/')).length} non-API routes; ${empty.length} empty shells`);
  process.exit(bad.length || empty.length ? 1 : 0);
}
