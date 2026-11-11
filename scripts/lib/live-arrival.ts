/**
 * How a live case ended, and how a run of them ends. A change arriving is what the check requires, however long it took
 * up to the patience the caller waited; the milliseconds it took is a Tier 2 value, reported against its bound and never
 * a gate (`docs/testing.md`). Only a change that never arrived, or a stream that stopped working, fails the run.
 */
import { NOT_RUN_EXIT } from './coverage.ts';

export type LiveStatus = 'ok' | 'warn' | 'FAIL' | 'not run';

/** One case's line, before the run's summary counts it. */
export type LiveOutcome = { status: LiveStatus; text: string };

/**
 * The verdict from the moment a change showed and the moment it was asked for: `at` is null when it never showed within
 * the patience the caller waited. Within `bound` is `ok`; past it is `warn` — a measured latency, reported, never a
 * failure; never is `FAIL`, because a change that does not arrive is the product not working.
 */
export function verdictOf(at: number | null, from: number, bound: number): { status: 'ok' | 'warn' | 'FAIL'; ms: number } {
  if (at === null) return { status: 'FAIL', ms: Infinity };
  const ms = at - from;
  return { status: ms > bound ? 'warn' : 'ok', ms };
}

/** A run's last line and its exit: 1 on a failure, 2 when nothing failed and a case did not run, 0 otherwise. */
export function liveSummary(outcomes: LiveOutcome[], pollMs: number): { line: string; exit: number } {
  const count = (status: LiveStatus) => outcomes.filter((o) => o.status === status).length;
  const [ok, warn, failed, skipped] = [count('ok'), count('warn'), count('FAIL'), count('not run')];
  return {
    line: `live: ${ok} ok, ${warn} warn, ${failed} FAIL, ${skipped} not run (poll ${pollMs} ms)`,
    exit: failed ? 1 : skipped ? NOT_RUN_EXIT : 0,
  };
}
