/**
 * Which browser suites a run judges (scripts/browser.ts).
 *
 * The function sweeps are Tier 1 and fail the run. They are four groups, so a person chasing one failure can run one
 * of them (`--only`) instead of the whole set: the audit, the presses, the keyboard walk, and the rest (navigation
 * unjudged, the personas, the assistant walk-throughs, the product's own checks, the build's sizes).
 *
 * The timed and perf suites are Tier 2: what they find is reported and never fails the run.
 */
export type FnSweep = 'audit' | 'interactions' | 'keyboard' | 'rest';

export const FN_SWEEPS: readonly FnSweep[] = ['audit', 'interactions', 'keyboard', 'rest'];

/** The sweeps a run executes: all of them without `--only`, exactly the named one with it; an unknown name throws. */
export function sweepsFor(only: string | undefined): Set<FnSweep> {
  if (only === undefined) return new Set(FN_SWEEPS);
  const named = FN_SWEEPS.find((s) => s === only);
  if (!named) throw new Error(`--only takes one of ${FN_SWEEPS.join(', ')}; got "${only}"`);
  return new Set([named]);
}

/** What a timed or perf suite's own verdict means for the run: a time past its line is reported, never a failure. */
export function timedOutcome(status: 'ok' | 'FAIL' | 'not run'): 'ok' | 'reported' | 'not run' {
  return status === 'FAIL' ? 'reported' : status;
}

/** A browser depth: the function sweeps, the timed suites, and the perf protocol. */
export type BrowserDepth = 'fn' | 'timed' | 'perf';

/**
 * How a depth's navigation is planned: `scripts/browser.ts` runs it `runs` times, and hands its budgets to the run as
 * judged only where the depth judges a time. The function sweep proves the rail navigates with its budgets unjudged;
 * the timed suites and the perf protocol judge them. Planning it here rather than at each call site keeps it once per
 * depth, and lets the test assert that plan instead of the run.
 */
export function navigationPlan(depth: BrowserDepth): { judged: boolean; runs: number } {
  return { judged: depth !== 'fn', runs: 1 };
}

/**
 * The depths each release stage asks the browser for, and the one the push gate asks for. The 20-sample protocol is
 * never among them: it is measured on its own stage, in its own job, because 20 samples across three conditions and two
 * devices outruns any job limit a gate can carry — measured, it took a product's push gate from 1 h 47 m to 2 h 37 m
 * against a 180-minute timeout — and a gate that waits on a measurement fails for the wrong reason. Its values still
 * reach the Tier 2 record and the release-to-release comparison, through `stage perf`.
 */
export const STAGE_DEPTHS = { tier2: 'timed', perf: 'perf' } as const;

/** What `test:release` asks for: the function sweeps and the timed runs, never the protocol. */
export const GATE_DEPTHS = 'fn,timed';

/**
 * What a run does after a step everything below depends on: the app server, or the assistant restart.
 *
 * The step's OWN result decides — never the run's failure flag. Reading the flag here ended a run at the first failure and
 * dropped the rest of the suite without saying so: on one product the assistant walk-through, the audit, the presses, the
 * keyboard walk, all six product checks and the whole timed set never ran and were never listed as not run, and the
 * closing line read as one failure among the checks that did run. A check that cannot run is reported, never left out —
 * so the signature is the fix: an earlier failure is not an argument, and cannot stop the run here.
 */
export function afterSetupStep(stepOk: boolean, what: string, why: string): { carryOn: boolean; notRun: string[] } {
  return stepOk ? { carryOn: true, notRun: [] } : { carryOn: false, notRun: [`every check after ${what} (${why})`] };
}
