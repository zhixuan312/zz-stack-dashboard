import { describe, expect, it } from 'vitest';
import { grainOf } from '@/lib/grain';

/**
 * One rule names the grain a series arrives in (Task I-139, AC-2.7): the gateway's `grainFor` cuts a window by week up
 * to 26 of them, by month up to three years and by quarter beyond, and every period it answers is whole from its
 * start to its end, so the first one says which. Record, Initiatives and what the assistant is told of both read it.
 */
const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** A series of periods as the gateway answers them, the first starting at `from`, each `next` after the one before. */
function cut(from: string, n: number, next: (ms: number) => number) {
  const windows = [];
  for (let i = 0, start = at(from); i < n; i++, start = next(start)) {
    windows.push({ from: iso(start), to: iso(next(start)), observedFrom: iso(start), observedThrough: iso(next(start)), complete: true });
  }
  return windows;
}
const months = (k: number) => (ms: number) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + k); return d.getTime(); };

describe('the grain of a series', () => {
  it('names a series cut by week `week`, by month `month` and by quarter `quarter`', () => {
    expect(grainOf(cut('2026-04-20T00:00:00Z', 26, (ms) => ms + 7 * DAY))).toBe('week');
    expect(grainOf(cut('2024-01-01T00:00:00Z', 34, months(1)))).toBe('month');
    expect(grainOf(cut('2022-01-01T00:00:00Z', 19, months(3)))).toBe('quarter');
  });

  it('reads the first period, so February, a 31-day month and a week across a clock change are each still named by it', () => {
    expect(grainOf(cut('2026-02-01T00:00:00Z', 3, months(1)))).toBe('month');
    expect(grainOf(cut('2026-01-01T00:00:00Z', 3, months(1)))).toBe('month');
    expect(grainOf(cut('2026-03-23T00:00:00Z', 2, (ms) => ms + 7 * DAY + 3_600_000))).toBe('week');
    // The shortest quarter, January to April, is still longer than any month.
    expect(grainOf(cut('2025-01-01T00:00:00Z', 2, months(3)))).toBe('quarter');
  });

  it('reads a running last period as nothing: the first decides, whatever the last holds so far', () => {
    const running = cut('2026-07-01T00:00:00Z', 4, months(1));
    running[3] = { ...running[3], observedThrough: '2026-10-05T00:00:00Z', complete: false };
    expect(grainOf(running)).toBe('month');
  });

  it('names a series with no period yet by the gateway\'s shortest grain, the week', () => {
    expect(grainOf([])).toBe('week');
  });
});
