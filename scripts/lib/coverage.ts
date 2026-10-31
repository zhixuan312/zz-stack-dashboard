/** Smoke route selection and coverage resolution: what is configured is checked, what is not is reported, never passed. */
import type { NavigationCheck } from './budgets.ts';

/** The suites `--full` adds: what is exhaustive and does not depend on the clock. */
export const COMPLETE_SUITES = ['audit', 'presses', 'keyboard', 'assistant', 'browserChecks'] as const;
/** The suites `--timed` adds: what judges a time, the navigation's budgets, the live stream, the product's own timed checks and Web Vitals. */
export const TIMED_SUITES = ['timing', 'live', 'timedChecks', 'vitals'] as const;
/** Every suite verify can list, in the order the coverage line prints them; verify keeps those the project has and the run asked for. */
export const SUITE_NAMES = [...COMPLETE_SUITES, ...TIMED_SUITES, 'perf'] as const;

const PROBES = ['dialog', 'filter', 'sort', 'toggle', 'link'];

/** The rules a check's output says it passed having judged nothing for (`judged nothing: <a>, <b>`, scripts/check.ts). */
export const judgedNothingIn = (out: string): string[] => [...out.matchAll(/^judged nothing: (.+)$/gm)].flatMap((m) => m[1].split(', '));

/** The exit code of a suite that failed nothing but left a case unrun: neither a pass nor a failure. */
export const NOT_RUN_EXIT = 2;

/**
 * What a suite's exit code means to verify: only 0 is a pass, and a suite that left a case unrun did not run. A pass whose
 * output has a line starting `warn` is a warning (a time that passed leaving less than a fifth of its limit, a product's own
 * check saying so): it passed, and the phase says it was near its line.
 */
export function suiteOutcome(status: number | null, out = ''): 'ok' | 'warn' | 'not run' | 'FAIL' {
  return status === 0 ? (/^warn\b/m.test(out) ? 'warn' : 'ok') : status === NOT_RUN_EXIT ? 'not run' : 'FAIL';
}

/**
 * The suites the coverage line names: those that did not run, and apart from them those that ran and failed. A suite
 * that failed ran; listing it as not run told the reader it had been skipped.
 */
export function suiteCoverage(suites: string[], passed: ReadonlySet<string>, failed: ReadonlySet<string>): { notRun: string[]; failed: string[] } {
  return { notRun: suites.filter((s) => !passed.has(s) && !failed.has(s)), failed: suites.filter((s) => failed.has(s)) };
}

/**
 * The last line of a passing verify. The standard is met only when nothing was left unrun, which takes both tiers. A list of
 * unrun suites that is wholly one tier the run did not ask for names the command that runs it; any other list names none.
 */
export function finalOutcome({ full, timed }: { full: boolean; timed: boolean }, notRun: string[]): string {
  if (!full && !timed) return 'every check that ran passed; pnpm verify --full --timed runs the rest';
  if (!notRun.length) return full && timed ? 'the project meets the Meridian standard' : 'every check that ran passed';
  const list = `every check that ran passed; not run: ${notRun.join(', ')}`;
  const only = (tier: readonly string[]) => notRun.every((s) => tier.includes(s));
  if (full && !timed && only(TIMED_SUITES)) return `${list}; pnpm verify --timed runs them`;
  if (timed && !full && only(COMPLETE_SUITES)) return `${list}; pnpm verify --full runs them`;
  return list;
}

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
 * Each route's coverage in `mode`; a `--timed` run passes `full`, so it holds every rail route mapped. Every mapping is
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
  for (const check of checks) {
    const problems = mappingErrors(check, known);
    errors.push(...problems);
    if (!problems.length) valid.add(check.path);
  }
  const mapped = new Set(checks.map((c) => c.path));
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
