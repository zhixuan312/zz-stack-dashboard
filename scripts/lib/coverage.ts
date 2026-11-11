/** Smoke route selection and coverage resolution: what is configured is checked, what is not is reported, never passed. */
import type { NavigationCheck } from './budgets.ts';

const PROBES = ['dialog', 'filter', 'sort', 'toggle', 'link'];

/** The rules a check's output says it passed having judged nothing for (`judged nothing: <a>, <b>`, scripts/check.ts). */
export const judgedNothingIn = (out: string): string[] => [...out.matchAll(/^judged nothing: (.+)$/gm)].flatMap((m) => m[1].split(', '));

/** The exit code of a suite that failed nothing but left a case unrun: neither a pass nor a failure. */
export const NOT_RUN_EXIT = 2;

const MAX_SMOKE = 3;

/** The explicit list when given, else the landing route and the first two other unique rail paths. */
export function selectSmokeRoutes({ smokeRoutes, nav, landing }: { smokeRoutes?: string[]; nav: string[]; landing: string }): string[] {
  if (smokeRoutes) {
    if (smokeRoutes.length > MAX_SMOKE) throw new Error(`smokeRoutes: at most ${MAX_SMOKE} routes, got ${smokeRoutes.length}`);
    for (const path of smokeRoutes) if (!nav.includes(path)) throw new Error(`smokeRoutes: ${path} is not one of the rail routes`);
    const dup = smokeRoutes.find((path, i) => smokeRoutes.indexOf(path) !== i);
    if (dup !== undefined) throw new Error(`smokeRoutes: ${dup} is listed twice`);
    return smokeRoutes;
  }
  return [landing, ...[...new Set(nav)].filter((path) => path !== landing).slice(0, MAX_SMOKE - 1)];
}

function mappingErrors(check: NavigationCheck, routes: string[]): string[] {
  const errors: string[] = [];
  // A journey presses the rail's link to the route, so a path the rail does not draw has no press to time (#97). A rail route
  // that redirects is followed under it; a page reached from a list is a detail route, pressed and walked by the others.
  if (!routes.includes(check.path)) errors.push(`${check.path}: a navigation check names a rail route, and this is not one: a journey times a press on the rail's link to it. For a rail route that redirects to a page under it (/things to /things/a), name the rail route: the journey follows it there. A page reached from a list belongs in detailRoutes`);
  for (const key of ['title', 'readySelector', 'controlSelector', 'resultSelector'] as const) {
    if (typeof check[key] !== 'string' || !check[key].trim()) errors.push(`${check.path}: navigation check has an empty ${key}`);
  }
  if (!PROBES.includes(check.probe)) errors.push(`${check.path}: navigation check probe ${JSON.stringify(check.probe)} is not one of ${PROBES.join(', ')}`);
  return errors;
}

/**
 * Each route's coverage in `mode`; a full run passes `full`, so it holds every rail route mapped. Every mapping is
 * validated against `known`, the project's rail routes, which default to `routes`: the default smoke resolves three routes
 * while the config maps the whole rail.
 */
export function resolveCoverage(
  mode: 'default' | 'full' | 'perf',
  routes: string[],
  checks: NavigationCheck[] = [],
  known: string[] = routes,
): {
  routes: { path: string; data: 'configured' | 'not-configured'; interaction: 'configured' | 'not-configured' }[];
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const valid = new Set<string>();
  const mapped = new Set<string>();
  const duplicates = new Set<string>();
  for (const check of checks) {
    const problems = mappingErrors(check, known);
    errors.push(...problems);
    if (mapped.has(check.path)) {
      if (!duplicates.has(check.path)) errors.push(`${check.path}: more than one navigation check is configured; each rail route must have exactly one`);
      duplicates.add(check.path);
    }
    mapped.add(check.path);
    if (!problems.length) valid.add(check.path);
  }
  for (const path of duplicates) valid.delete(path);
  const out = routes.map((path) => {
    const state = valid.has(path) ? 'configured' : 'not-configured';
    if (!mapped.has(path)) {
      const line = `${path}: no navigation check is configured, so data readiness and interaction are not covered`;
      (mode === 'default' ? warnings : errors).push(line);
    }
    return { path, data: state, interaction: state } as const;
  });
  return { routes: out, errors, warnings };
}

/**
 * The routes of a run the project has configured no navigation check for. The navigation walk judges their shell and
 * reports data and interaction not configured; the 20-sample protocol has nothing to sample there at all. Both are
 * declared configuration, never passes, and neither holds the last-green marker.
 */
export function unconfiguredRoutes(routes: string[], checks: { path: string }[] = []): string[] {
  const mapped = new Set(checks.map((c) => c.path));
  return routes.filter((r) => !mapped.has(r));
}

/**
 * Whether a prefetch budget is the project's own promise. The phone-closed cap holds only where the rail is in a drawer on
 * a phone — the template's design, where nothing prefetches until the drawer opens. A project whose rail is in the page
 * prefetches what its visible links point at, so the cap is not its promise: it is reported not-configured, with this
 * reason, never dropped silently.
 */
export function prefetchJudged(device: 'desktop' | 'phoneClosed', starts: string[]): { judged: boolean; reason?: string } {
  if (device === 'desktop') return { judged: true };
  return starts.length ? { judged: true } : { judged: false, reason: "the project's rail is not in a drawer on a phone" };
}

/**
 * A case a project left unrun by its own configuration — no navigation check for a rail route, a rail not in a drawer
 * on a phone — rather than because the evidence was missing. A rerun can never change it: it is reported as not run with
 * its reason on every run, and it does not hold the last-green marker.
 */
export function declaredNotRun(entry: string): boolean {
  return /: no navigation check is configured$/.test(entry)
    || /^prefetch phone with the drawer closed: the project's rail is not in a drawer on a phone$/.test(entry)
    || /^the size baseline is the release's, not the project's;/.test(entry)
    || /^the project has no scripts\/verify\.baseline\.json;/.test(entry);
}

/**
 * A failed suite's output without the audit's design-metrics table: one line per route, printed last, so on a product of
 * fifty routes the lines kept beneath a failure were nearly all metrics and the FAIL blocks above them were cut off.
 */
export function withoutMetrics(out: string[]): string[] {
  const start = out.findIndex((l) => /^Design metrics at \d+:$/.test(l));
  if (start < 0) return out;
  const end = out.findIndex((l, i) => i > start && l.trim() === '');
  return [...out.slice(0, start), ...(end < 0 ? [] : out.slice(end))];
}
