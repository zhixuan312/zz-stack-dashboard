// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SETTLE_MS, slowRule } from '../scripts/states-check.ts';
import { BOUND_MS, boundRule } from '../scripts/states-timed.ts';
import config from '../scripts/verify.config.ts';

/**
 * The `slow` state's five-second bound (scripts/states-timed.ts, Task I-142; AC-2.9), judged over a recorded frame: the
 * first frame the observer saw an explicit state in, against navigation start. The same frame is judged by
 * states-check, which runs beside the other suites and says only whether the state arrived; this runs alone in the
 * timed tier, and says when.
 */
const frames = (explicit: number | null) => ({ placeholder: null, main: 180, loadingAtMain: true, contentAtMain: false, refusedAtMain: false, explicit });
const seen = (explicit: number | null) => ({ content: explicit !== null, refusal: false, alert: false, frames: frames(explicit) });

describe("the slow state's bound", () => {
  it('is five seconds', () => {
    expect(BOUND_MS).toBe(5_000);
  });

  it('passes a row whose explicit state arrived within it, saying when', () => {
    const r = boundRule(frames(4_530));
    expect(r.problems).toEqual([]);
    expect(r.said).toBe('explicit state at 4530 ms, within 5000 ms');
    expect(boundRule(frames(5_000)).problems).toEqual([]);
  });

  it('fails a row whose explicit state arrived after it, naming the time, which states-check passes', () => {
    // Wave 2's acceptance under load: two rows at 5.1 to 5.8 s (Harbormaster #3482).
    const r = boundRule(frames(5_800));
    expect(r.problems).toEqual(['explicit state at 5800 ms, past the 5000 ms bound']);
    expect(slowRule(seen(5_800)).problems).toEqual([]);
  });

  it('fails a row with no explicit state at all, as states-check does', () => {
    expect(boundRule(frames(null)).problems.join(' ')).toContain(`no explicit state within the ${SETTLE_MS / 1000} s a page is given, past the ${BOUND_MS} ms bound`);
    expect(slowRule({ ...seen(null), content: false }).problems.length).toBeGreaterThan(0);
  });

  it('runs in timedChecks, alone, and not in browserChecks', () => {
    expect(config.timedChecks).toContain('scripts/states-timed.ts');
    expect(config.browserChecks).not.toContain('scripts/states-timed.ts');
  });
});
