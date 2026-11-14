/**
 * The lines a run's output is held to: a verdict's tag, the entries a browser stage owes when it could not run, and the
 * vitals summary. Pure, so the wording can be tested without starting a browser or a build.
 */

/** The tag a status prints with: FAIL is never printed as ok, and a warn never as a pass. */
export const verdictTag = (status: 'ok' | 'warn' | 'FAIL' | 'not run'): string =>
  status === 'FAIL' ? 'FAIL   ' : status === 'warn' ? 'warn   ' : status === 'not run' ? 'not run ' : 'ok     ';

/**
 * What a Tier 1 run owes when its browser-fixture stage was needed and could not run (no Chrome): missing evidence,
 * reported as not run, so the closing line never reads "every check passed".
 */
export const deepBrowserNotRun = (needed: boolean, ran: boolean): string[] =>
  needed && !ran ? ['Tier 1 browser-fixture tests (no Chrome)'] : [];

/** The vitals closing line, counting the pages over a floor apart from those near one. */
export function vitalsSummary(total: number, failures: number, overFloor: number, nearFloor: number): string {
  const under = total - failures - overFloor;
  return `vitals: ${under} of ${total} pages under LCP 2.5 s, INP 200 ms, CLS 0.1 and no dropped frame on a mid-range phone${overFloor ? `; ${overFloor} over a floor` : ''}${nearFloor ? `; ${nearFloor} within 20% of a floor` : ''}`;
}
