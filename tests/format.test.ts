import { niceScale } from '@/components/charts/TrendChart';
import {
  FORMATTERS,
  formatAxisCount,
  formatBy,
  formatCost,
  formatCount,
  formatDuration,
  formatPercent,
  formatTokens,
} from '@/lib/format';
import { parsePeriod, periodCutoff, DEFAULT_PERIOD } from '@/lib/period';
import { TINTS, TINT_VAR, cycleTint } from '@/lib/tints';

/**
 * The formatters exist to keep "we measured zero" distinguishable from "nobody
 * measured". That distinction is the thing worth locking down — a coercion
 * added later would silently turn every gap in the data into a confident 0.
 */
describe('formatters', () => {
  it('renders null as an em dash, never as zero', () => {
    expect(formatCost(null)).toBe('—');
    expect(formatCount(null)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatPercent(null)).toBe('—');
    expect(formatTokens(null)).toBe('—');
  });

  it('renders a measured zero as zero', () => {
    expect(formatCost(0)).toBe('$0');
    expect(formatCount(0)).toBe('0');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('never rounds 999,999 up to 1000K', () => {
    expect(formatTokens(999_999)).toBe('1.0M');
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

describe('tints', () => {
  it('gives every tint a CSS variable', () => {
    for (const t of TINTS) expect(TINT_VAR[t]).toMatch(/^var\(--/);
  });

  it('cycles rather than running off the end', () => {
    expect(cycleTint(TINTS.length)).toBe(cycleTint(0));
  });
});

describe('formatAxisCount', () => {
  /* THE ONE PROPERTY AN AXIS FORMATTER HAS: neighbouring ticks must read as different
   * numbers. The overview's tool-call chart ran 0…3,000 in steps of 500 and rendered
   * `0 · 500 · 1K · 2K · 2K · 3K · 3K` — three duplicate pairs, from rounding to whole
   * thousands. Asserted over the scales `niceScale` actually produces rather than on one
   * remembered case, so the next step size that collides is caught here. */
  it('never gives two ticks on one scale the same label', () => {
    /* SWEPT, NOT CHOSEN. A handful of round maxima all happen to land on step sizes that
       format distinctly — the first version of this test picked seven of them and passed
       against the very rounding it was written to catch. The scale that actually broke was
       max 3,000 in steps of 500, which `niceScale` produces from a raw max near 2,600 and
       from nothing rounder. Sweeping the range is what makes the assertion about the rule
       rather than about the examples. */
    const bad: string[] = [];
    for (let raw = 1; raw <= 6000; raw += 1) {
      const { max: top, step } = niceScale(raw);
      const ticks: number[] = [];
      for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
      const labels = ticks.map(formatAxisCount);
      if (new Set(labels).size !== labels.length) bad.push(`${raw} -> ${labels.join(' · ')}`);
    }
    expect(bad.slice(0, 3)).toEqual([]);
  });

  it('keeps a decimal only where the number needs one', () => {
    expect(formatAxisCount(1500)).toBe('1.5K');
    expect(formatAxisCount(2000)).toBe('2K');
    expect(formatAxisCount(2_500_000)).toBe('2.5M');
    expect(formatAxisCount(0)).toBe('0');
    expect(formatAxisCount(500)).toBe('500');
  });
});
