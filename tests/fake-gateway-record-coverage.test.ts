import { describe, expect, it, vi } from 'vitest';

import type { PeriodFigure } from '../src/lib/platform-shapes.ts';
import type { RecordRead } from '../src/lib/work-shapes.ts';

/**
 * The fake's Record counts nothing before its `coverageFrom`, in any period (Task I-131, AC-2.8), as the gateway's
 * slices answer: a period that begins before the team's first record answers no run, no day and no search before it,
 * its periods still the period's own, so a year never counts more than all.
 *
 * DELIBERATE: the fake's clock is the moment its modules load, and its first record when atlas's first initiative
 * opened, seven weeks before that week's Monday, so a year begins before the first record only from late February on.
 * The clock is pinned at 18 October 2026, before the fake is imported, so the year's case is real whatever day the test
 * runs. Every period starts at midnight in the reporting timezone, Singapore's, eight hours before UTC's.
 */
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-18T04:00:00Z'));
const { record } = await import('../scripts/fake-gateway/work-record.ts');
const { ME } = await import('../scripts/fake-gateway/people.ts');
const { localDay } = await import('../scripts/fake-gateway/clock.ts');
vi.useRealTimers();

const PERIODS = ['quarter', 'year', 'all'] as const;
const answer = (period: string) => record(ME, new URLSearchParams(`period=${period}`))[1] as RecordRead;
const R = Object.fromEntries(PERIODS.map((p) => [p, answer(p)])) as Record<(typeof PERIODS)[number], RecordRead>;
const agentsOf = (r: RecordRead) => (r.agents.state === 'ok' ? r.agents.data : null)!;
const knowledgeOf = (r: RecordRead) => (r.knowledge.state === 'ok' ? r.knowledge.data : null)!;
const searched = (r: RecordRead) => knowledgeOf(r).searchesWithResults.reduce((n, p) => n + (p.denominator ?? 0), 0);
const ran = (r: RecordRead) => agentsOf(r).days.reduce((n, d) => n + d.runs, 0);

describe("the fake's Record before its coverageFrom", () => {
  it('is a real case: the year begins before the first record, the period and coverageFrom as before', () => {
    expect(R.year.meta.period).toEqual({ from: '2025-12-31T16:00:00Z', to: '2026-10-18T04:00:00Z' });
    expect(R.quarter.meta.period.from).toBe('2026-09-30T16:00:00Z');
    for (const p of PERIODS) expect(R[p].meta.coverageFrom).toBe('2026-08-24T12:00:00Z');
    expect(R.all.meta.period.from).toBe(R.all.meta.coverageFrom);
  });

  for (const p of PERIODS) {
    it(`answers no run and no day before it, the days from the later of the period's start and it (${p})`, () => {
      const { days } = agentsOf(R[p]);
      const from = localDay(Date.parse([R[p].meta.period.from, R[p].meta.coverageFrom!].sort().at(-1)!));
      expect(days.filter((d) => d.day < localDay(Date.parse(R[p].meta.coverageFrom!)))).toEqual([]);
      expect(days[0].day).toBe(from);
      expect(days.reduce((n, d) => n + d.runs, 0)).toBeGreaterThan(0);
    });

    it(`answers no search in a period that ends by it, its periods still the period's own (${p})`, () => {
      const k = knowledgeOf(R[p]);
      expect(k.searchesWithResults.map((x) => x.window)).toEqual(R[p].cumulative.map((x) => x.window));
      const before = k.searchesWithResults.filter((x) => x.window.to <= R[p].meta.coverageFrom!);
      expect(before).toEqual(before.map((x): PeriodFigure => ({ window: x.window, figure: { value: null, why: 'no_data' }, numerator: 0, denominator: 0 })));
      expect(k.adoptedInAll.filter((x) => x.window.to <= R[p].meta.coverageFrom!).every((x) => x.figure.value === 0)).toBe(true);
      if (p === 'year') expect(before.length).toBeGreaterThan(0);
    });
  }

  it("counts no more in the year or the quarter than in all", () => {
    for (const p of ['quarter', 'year'] as const) {
      expect(ran(R[p])).toBeLessThanOrEqual(ran(R.all));
      expect(searched(R[p])).toBeLessThanOrEqual(searched(R.all));
    }
  });
});
