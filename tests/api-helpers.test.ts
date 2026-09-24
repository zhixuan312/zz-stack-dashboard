import { describe, expect, it } from 'vitest';
import { freshnessOf } from '@/lib/api';
import { teamSlug } from '@/lib/api-shapes';

/**
 * The two pure functions in `@/lib/api`.
 *
 * COUPLED: this file lives in `tests/` because vitest.config.ts scans only `tests/**` — a
 * test anywhere else is skipped in silence while the suite still reports success.
 */
describe('teamSlug', () => {
  it('takes the team out of a `<slug> (<role>)` entry', () => {
    // `/people` formats each membership for display, so one person holding two roles on a
    // team arrives as two entries that must fold to one team.
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
    // Null, not now: a header over cached data or over an error state must not claim to have
    // been updated at render time.
    expect(freshnessOf({ dataUpdatedAt: 0 })).toBeNull();
    expect(freshnessOf({})).toBeNull();
    expect(freshnessOf()).toBeNull();
  });

  it('ignores a query that has not loaded beside one that has', () => {
    const at = Date.parse('2026-09-18T10:00:00Z');
    expect(freshnessOf({ dataUpdatedAt: at }, { dataUpdatedAt: 0 })?.getTime()).toBe(at);
  });
});
