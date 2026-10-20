import { describe, expect, it } from 'vitest';
import { PERIODS, PERIOD_DAYS, PERIOD_LABEL, PERIOD_SHORT, parsePeriod } from '@/lib/period';

/**
 * The reporting-period vocabulary, which is duplicated on purpose in the gateway's own
 * `PERIOD_DAYS` (services/gateway/src/console/shared.ts). Two build systems, one origin, no shared module between
 * them, so these tests pin the half this repository owns and the gateway's fallback covers
 * the day they disagree: an unknown period there means all time, never an error.
 */
describe('the period vocabulary', () => {
  it('offers all time plus the four windows, all time first in nobody-chose', () => {
    expect(PERIODS).toEqual(['1d', '7d', '30d', '90d', 'all']);
    expect(parsePeriod(undefined)).toBe('all');
  });

  it('labels every period it offers, with no orphans either way', () => {
    // A period in the list with no label renders a blank segment; a label with no period is
    // dead text nobody can select. Both directions, so neither can rot alone. (The day counts
    // are a Record over the same type, so the compiler holds those.)
    for (const p of PERIODS) expect(PERIOD_LABEL[p]).toBeTruthy();
    expect(Object.keys(PERIOD_LABEL).sort()).toEqual([...PERIODS].sort());
    expect(Object.keys(PERIOD_SHORT).sort()).toEqual([...PERIODS].sort());
  });

  it('treats anything it does not recognise as the default, never as a cast', () => {
    // The value arrives from the address bar, so it is whatever somebody typed.
    for (const raw of [null, undefined, '', '30', 'last-week', '../etc/passwd', '1D']) {
      expect(parsePeriod(raw)).toBe('all');
    }
    expect(parsePeriod('1d')).toBe('1d');
  });
});

describe('the days a period counts back', () => {
  it('names the gateway\'s own windows, and no bound for all time', () => {
    // The gateway's PERIOD_DAYS (services/gateway/src/console/shared.ts) reads the same days; all time is no bound.
    expect(PERIOD_DAYS).toEqual({ '1d': 1, '7d': 7, '30d': 30, '90d': 90, all: null });
  });
});
