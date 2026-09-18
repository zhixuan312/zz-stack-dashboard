import { describe, expect, it } from 'vitest';
import { freshnessOf, teamSlug } from '@/lib/api';

/**
 * The two pure functions in `@/lib/api`, each written because a page got the answer wrong.
 *
 * THIS FILE REPLACES `me-shape.test.ts`, which constructed a `Me` literal and then asserted
 * that the literal it had just written said what it said. It exercised no code and no
 * response: it would have passed unchanged the day the gateway reverted `teams` to
 * `string[]`, because the only thing standing behind it was the compiler, asserted twice.
 *
 * This file lives in `tests/` because vitest.config.ts scans ONLY `tests/**` — a test
 * anywhere else is skipped in silence while the suite still reports success.
 */
describe('teamSlug', () => {
  it('takes the team out of a `<slug> (<role>)` entry', () => {
    // `/people` formats each membership for display, so the People page counted
    // `xuan (admin)` and `xuan (member)` as two different teams: a platform of three read
    // four, five or six the moment any team had both a member and an admin.
    expect(teamSlug('xuan (admin)')).toBe('xuan');
    expect(teamSlug('xuan (member)')).toBe('xuan');
    expect(new Set(['xuan (admin)', 'xuan (member)', 'quan (admin)'].map(teamSlug)).size).toBe(2);
  });

  it('leaves a bare slug alone', () => {
    expect(teamSlug('zz-platform')).toBe('zz-platform');
  });
});

describe('freshnessOf', () => {
  it('reports the OLDEST query, because a page is as fresh as its stalest panel', () => {
    const older = Date.parse('2026-09-18T10:00:00Z');
    const newer = Date.parse('2026-09-18T10:05:00Z');
    expect(freshnessOf({ dataUpdatedAt: newer }, { dataUpdatedAt: older })?.toISOString())
      .toBe(new Date(older).toISOString());
  });

  it('is null before anything has loaded, never now', () => {
    // Every page used to pass `updatedAt={new Date()}`, evaluated at render — so the header
    // read "Updated just now" over thirty-second-old cached data and over the error state
    // itself. A stamp that cannot be false is not a stamp.
    expect(freshnessOf({ dataUpdatedAt: 0 })).toBeNull();
    expect(freshnessOf({})).toBeNull();
    expect(freshnessOf()).toBeNull();
  });

  it('ignores a query that has not loaded beside one that has', () => {
    const at = Date.parse('2026-09-18T10:00:00Z');
    expect(freshnessOf({ dataUpdatedAt: at }, { dataUpdatedAt: 0 })?.getTime()).toBe(at);
  });
});
