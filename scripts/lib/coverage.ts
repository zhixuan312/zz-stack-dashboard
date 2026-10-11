/** Smoke route selection and coverage resolution: what is configured is checked, what is not is reported, never passed. */
import type { NavigationCheck } from './budgets.ts';

const PROBES = ['dialog', 'filter', 'sort', 'toggle', 'link'];

/** The exit code of a suite that failed nothing but left a case unrun: neither a pass nor a failure. */
export const NOT_RUN_EXIT = 2;

/** What a suite's exit code means to verify: only 0 is a pass, and a suite that left a case unrun did not run. */
export function suiteOutcome(status: number | null): 'ok' | 'not run' | 'FAIL' {
  return status === 0 ? 'ok' : status === NOT_RUN_EXIT ? 'not run' : 'FAIL';
}

/**
 * The suites the coverage line names: those that did not run, and apart from them those that ran and failed. A suite
 * that failed ran; listing it as not run told the reader it had been skipped.
 */
export function suiteCoverage(suites: string[], passed: ReadonlySet<string>, failed: ReadonlySet<string>): { notRun: string[]; failed: string[] } {
  return { notRun: suites.filter((s) => !passed.has(s) && !failed.has(s)), failed: suites.filter((s) => failed.has(s)) };
}

/** The last line of a passing verify: the full standard is met only when every suite of the depth ran. */
export function finalOutcome(full: boolean, notRun: string[]): string {
  if (!full) return 'every check that ran passed; pnpm verify --full runs the rest';
  return notRun.length ? `every check that ran passed; not run: ${notRun.join(', ')}` : 'the project meets the Meridian standard';
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
  if (!routes.includes(check.path)) errors.push(`${check.path}: navigation check names a path that is not a route`);
  for (const key of ['title', 'readySelector', 'controlSelector', 'resultSelector'] as const) {
    if (typeof check[key] !== 'string' || !check[key].trim()) errors.push(`${check.path}: navigation check has an empty ${key}`);
  }
  if (!PROBES.includes(check.probe)) errors.push(`${check.path}: navigation check probe ${JSON.stringify(check.probe)} is not one of ${PROBES.join(', ')}`);
  return errors;
}

/**
 * Each route's coverage in `mode`. Every mapping is validated against `known`, the project's rail routes, which default to
 * `routes`: the default smoke resolves three routes while the config maps the whole rail.
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
  return { routes: out.map((r) => ({ ...r })), errors, warnings };
}
