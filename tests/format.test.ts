import { niceTicks } from '@/components/charts/scale';
import {
  AXIS_FORMATTERS,
  FORMATTERS,
  formatBy,
  formatCount,
  formatDuration,
  formatPercent,
  formatCompact,
} from '@/lib/format';
import { parsePeriod, periodCutoff, DEFAULT_PERIOD } from '@/lib/period';

/**
 * The formatters keep "we measured zero" distinguishable from "nobody measured". A coercion
 * added later would turn every gap in the data into a confident 0.
 */
describe('formatters', () => {
  it('renders null as an em dash, never as zero', () => {
    expect(FORMATTERS.cost(null)).toBe('—');
    expect(formatCount(null)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatPercent(null)).toBe('—');
    expect(formatCompact(null)).toBe('—');
  });

  it('renders a measured zero as zero', () => {
    expect(FORMATTERS.cost(0)).toBe('$0');
    expect(formatCount(0)).toBe('0');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('never rounds 999,999 up to 1000K', () => {
    expect(formatCompact(999_999)).toBe('1.0M');
  });

  it('does not report Infinity for a non-finite percentage', () => {
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('named formatters', () => {
  it('covers every NumberFormat name', () => {
    for (const [name, fn] of Object.entries(FORMATTERS)) {
      expect(typeof fn(1), name).toBe('string');
    }
  });

  it('defaults to count when no name is given', () => {
    expect(formatBy(undefined, 1234)).toBe(formatCount(1234));
  });
});

describe('period', () => {
  it('never casts an untrusted value through', () => {
    expect(parsePeriod('nonsense')).toBe(DEFAULT_PERIOD);
    expect(parsePeriod(null)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod('7d')).toBe('7d');
  });

  it('has no cutoff for all-time', () => {
    expect(periodCutoff('all')).toBeNull();
  });

  it('cuts off the right number of days back', () => {
    const now = new Date('2026-08-16T00:00:00Z');
    expect(periodCutoff('7d', now)?.toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });
});

describe('the count axis', () => {
  /* The one property an axis formatter has: neighbouring ticks must read as different
   * numbers. Asserted over the ticks the charts' `niceTicks` actually produces rather than over
   * chosen cases, so the next step size that collides is caught here. */
  it('never gives two ticks on one scale the same label', () => {
    /* DELIBERATE: swept, not chosen. Round maxima happen to land on step sizes that format
       distinctly, so a hand-picked set passes against the very rounding this is written to
       catch. Sweeping the range makes the assertion about the rule. */
    const bad: string[] = [];
    for (let raw = 1; raw <= 6000; raw += 1) {
      for (const n of [3, 4]) {
        const labels = niceTicks(raw, n).map((t) => AXIS_FORMATTERS.count(t));
        if (new Set(labels).size !== labels.length) bad.push(`${raw}/${n} -> ${labels.join(' · ')}`);
      }
    }
    expect(bad.slice(0, 3)).toEqual([]);
  });

  it('keeps a decimal only where the number needs one', () => {
    expect(AXIS_FORMATTERS.count(1500)).toBe('1.5K');
    expect(AXIS_FORMATTERS.count(2000)).toBe('2K');
    expect(AXIS_FORMATTERS.count(2_500_000)).toBe('2.5M');
    expect(AXIS_FORMATTERS.count(0)).toBe('0');
    expect(AXIS_FORMATTERS.count(500)).toBe('500');
  });
});
