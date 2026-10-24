import { describe, expect, it } from 'vitest';

import { formatDateTime } from '@/lib/format-date';
import type { ReadMeta } from '@/lib/platform-shapes';
import { stampOf } from '@/logic/read-stamp';

/**
 * The masthead's stamp (Task I-12, AC-2.2, FR-2): whether an answer was served is the cache's own `meta.cacheHit`, and
 * the two instants choose only the words. The fourth case is the one that separates the two implementations. Every
 * ordinary miss has two different instants — `asOf` is rounded up to a whole second while `observedAt` is this request's
 * own — so a stamp that inferred the hit by comparing them would announce a served answer that this request computed
 * itself. Replacing `!meta.cacheHit` in `read-stamp.ts` with `secondOf(meta.asOf) === secondOf(meta.observedAt)` was
 * run: the fourth case reddened with `Received: "Computed 25 Oct 2026, 17:12 · served 25 Oct 2026, 17:13"` where it
 * expected `"As of 25 Oct 2026, 17:12"` — proved, not assumed. The first and third cases reddened with it, because they
 * pin the same boolean from the other side; the second stayed green.
 */

/** A read's `meta` as a page receives it: the six a gateway route states, and the five the envelope writes onto them. */
const meta = (over: Partial<ReadMeta> = {}): ReadMeta => ({
  asOf: '2026-10-25T09:12:00Z',
  timezone: 'Asia/Singapore',
  period: { from: '2026-10-18T00:00:00Z', to: '2026-10-25T00:00:00Z' },
  scope: 'active-team',
  population: 'the team',
  coverageFrom: null,
  observedAt: '2026-10-25T09:12:00Z',
  revision: null,
  builtAt: null,
  sourceRevision: null,
  cacheHit: false,
  ...over,
});

const COMPUTED = '2026-10-25T09:12:00Z';
const A_MINUTE_LATER = '2026-10-25T09:13:00Z';
const LATER_IN_THE_SAME_SECOND = '2026-10-25T09:12:00.900Z';

describe('stampOf', () => {
  it('stamps an answer computed for this request with one instant, and no served one', () => {
    const { text, title } = stampOf(meta({ cacheHit: false, observedAt: A_MINUTE_LATER }));
    expect(text).toBe(`As of ${formatDateTime(COMPUTED)}`);
    expect(text).not.toMatch(/served|Computed/);
    // The title is the precision slot, and it names the one instant this answer is as of: `08:04` widens to `08:04:00`.
    expect(title).toBe(`Computed ${formatDateTime(COMPUTED)}:00`);
    expect(title).not.toMatch(/served/);
  });

  it('stamps both instants when the cache served an answer and they differ', () => {
    const { text, title } = stampOf(meta({ cacheHit: true, observedAt: A_MINUTE_LATER }));
    expect(text).toBe(`Computed ${formatDateTime(COMPUTED)} · served ${formatDateTime(A_MINUTE_LATER)}`);
    expect(title).toBe(`Computed ${formatDateTime(COMPUTED)}:00 · served ${formatDateTime(A_MINUTE_LATER)}:00`);
  });

  it('names one instant when the cache served an answer and both instants fall in the same second', () => {
    const { text } = stampOf(meta({ cacheHit: true, observedAt: LATER_IN_THE_SAME_SECOND }));
    expect(text).toBe(`Computed ${formatDateTime(COMPUTED)}`);
    // ...and the title still holds both, because the seconds are where they can be told apart at all.
    expect(stampOf(meta({ cacheHit: true, observedAt: LATER_IN_THE_SAME_SECOND })).title)
      .toBe(`Computed ${formatDateTime(COMPUTED)}:00 · served ${formatDateTime(LATER_IN_THE_SAME_SECOND)}:00`);
  });

  it('names one instant on a miss whose instants differ, because nothing was served', () => {
    const { text, title } = stampOf(meta({ cacheHit: false, observedAt: A_MINUTE_LATER }));
    expect(text).toBe(`As of ${formatDateTime(COMPUTED)}`);
    expect(text).not.toMatch(/served/);
    expect(title).not.toMatch(/served/);
  });
});
