import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERIOD, PERIODS, PERIOD_DAYS, PERIOD_LABEL, parsePeriod, periodCutoff,
} from '@/lib/period';

/**
 * The reporting-period vocabulary — which is duplicated, on purpose, in the gateway's own
 * `PERIOD_DAYS` (console.ts). Two build systems, one origin, no shared module between
 * them, so these tests pin the half this repository owns and the gateway's fallback covers
 * the day they disagree: an unknown period there means all time, never an error.
 */
describe('the period vocabulary', () => {
  it('offers all time plus the four windows, all time first in nobody-chose', () => {
    expect(PERIODS).toEqual(['1d', '7d', '30d', '90d', 'all']);
    expect(DEFAULT_PERIOD).toBe('all');
  });

  it('labels and day-counts every period it offers, with no orphans either way', () => {
    // A period in the list with no label renders a blank menu row; a label with no period
    // is dead text nobody can select. Both directions, so neither can rot alone.
    for (const p of PERIODS) {
      expect(PERIOD_LABEL[p]).toBeTruthy();
      expect(p in PERIOD_DAYS).toBe(true);
    }
    expect(Object.keys(PERIOD_LABEL).sort()).toEqual([...PERIODS].sort());
    expect(Object.keys(PERIOD_DAYS).sort()).toEqual([...PERIODS].sort());
  });

  it('treats anything it does not recognise as the default, never as a cast', () => {
    // The value arrives from the address bar, so it is whatever somebody typed.
    for (const raw of [null, undefined, '', '30', 'last-week', '../etc/passwd', '1D']) {
      expect(parsePeriod(raw)).toBe(DEFAULT_PERIOD);
    }
    expect(parsePeriod('1d')).toBe('1d');
  });
});

describe('the cutoff a period resolves to', () => {
  const now = new Date('2026-09-09T12:00:00Z');

  it('is null for all time — an absent bound, not a very old one', () => {
    // The gateway's SQL reads `($n is null or ts >= $n)`, so null is what turns the
    // predicate off. A cutoff at the epoch would filter, and would be wrong the day
    // somebody backdates a row.
    expect(periodCutoff('all', now)).toBeNull();
    expect(PERIOD_DAYS.all).toBeNull();
  });

  it('counts back exactly the days it names', () => {
    expect(periodCutoff('1d', now)?.toISOString()).toBe('2026-09-08T12:00:00.000Z');
    expect(periodCutoff('7d', now)?.toISOString()).toBe('2026-09-02T12:00:00.000Z');
    expect(periodCutoff('90d', now)?.toISOString()).toBe('2026-06-11T12:00:00.000Z');
  });

  it('orders the windows so a longer period never cuts off later than a shorter one', () => {
    const cuts = ['1d', '7d', '30d', '90d'].map((p) => periodCutoff(p as never, now)!.getTime());
    expect(cuts).toEqual([...cuts].sort((a, b) => b - a));
  });
});
