import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: vi.fn() }));
/** Every Heatmap the pages draw, with the props it was handed, drawn as the release draws it. */
const heat = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('@/components/charts/heatmap', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/charts/heatmap')>();
  return { ...real, Heatmap: (p: Parameters<typeof real.Heatmap>[0]) => { heat.props.push(p); return createElement(real.Heatmap, p); } };
});

import type { Runs } from '@/lib/destination-shapes';
import type { Usage } from '@/lib/fleet-shapes';
import { formatCalendarDate, formatDay } from '@/lib/format-date';
import type { PlatformStatus } from '@/lib/platform-shapes';
import type { RecordRead } from '@/lib/work-shapes';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { RecordView } from '@/views/pages/record';
import { RunsView } from '@/views/pages/runs';
import { statusRead } from '@/views/platform-status-context';
import { recordPath } from '@/views/record-context';
import { RUNS_DEFAULTS, runsPath } from '@/views/runs-context';
import { ME } from '../scripts/fake-gateway/people.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

/**
 * A gap is never drawn as zero (Task I-124, AC-2.8). Where a figure has no number the card is handed none, and says the
 * page's own word in its place; where a Heatmap, which draws no gap, is handed days from before the record begins, the
 * page draws no cell before that start and names it, and draws no week of hours until a whole week was observed. Each
 * answer is the fake gateway's own, the one `pnpm verify` serves, with one part changed as the gateway could answer it.
 */
const wrap = (node: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Tooltip.Provider>{node}</Tooltip.Provider></QueryClientProvider>);
const text = () => document.body.textContent ?? '';
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
/** What the page handed a Heatmap: the calendar's days, or the week of hours. */
const calendar = () => heat.props.filter((p) => 'days' in p).at(-1) as { days: { date: string; value: number }[] } | undefined;
const hours = () => heat.props.filter((p) => 'values' in p);
const panel = (title: string) => screen.getByRole('heading', { name: title }).closest('section, .card') as HTMLElement;

beforeEach(() => {
  heat.props = [];
  // Nothing here reads in the browser: every page is handed the server's read, and a read it makes never answers.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe('a figure with no number', () => {
  it('Status\'s featured metric is handed no number and sets the page\'s own dash, never a 0 it formats away', () => {
    const measures = PLATFORM_STATUS.measures.map((m) =>
      (m.key === 'malformed_per_1000' && m.last ? { ...m, last: { ...m.last, figure: { value: null, why: 'unavailable' as const }, numerator: null, denominator: null } } : m));
    const { container } = wrap(<PlatformStatusView read={statusRead({ ...PLATFORM_STATUS, measures } as PlatformStatus)} />);
    const half = container.querySelectorAll('[data-figures] [data-figure]')[0] as HTMLElement;
    expect(half.querySelector('[data-value] [data-missing]')?.textContent).toBe('—');
    expect(half.textContent).toContain('Unavailable: not worked out for the');
    expect(half.querySelector('[data-value]')!.textContent).not.toMatch(/\d/);
  });

  it('Runs\' empty state says the Runs tile\'s own word for a count nobody read, never "0 runs so far"', () => {
    const answer = runs(ME, new URLSearchParams(runsPath(RUNS_DEFAULTS).split('?')[1]))[1] as Runs;
    const unread: Runs = { ...answer, tiles: { ...answer.tiles, runs: { value: null, why: 'unavailable' } }, recent: { state: 'ok', data: { rows: [], total: 0 } } };
    wrap(<RunsView served={{ state: 'ok', path: runsPath(RUNS_DEFAULTS), data: unread }} />);
    expect(text()).toContain('A run appears here once your team\'s agents follow a skill. Runs so far: Unavailable.');
    expect(text()).not.toMatch(/\b0 runs so far/);
  });

  it('Record\'s lead is handed no number when the retained text was not read, and says so in the figure\'s place', () => {
    const answer = record(ME, new URLSearchParams('period=all'))[1] as RecordRead;
    window.history.replaceState(null, '', '/record');
    const { container } = wrap(<RecordView served={{ state: 'ok', path: recordPath({ period: 'all', page: '1' }), data: { ...answer, lead: { ...answer.lead, estimate: null } }, team: 'atlas' }} />);
    expect(container.querySelector('[data-figure] [data-value] [data-missing]')?.textContent).toBe('Unavailable');
  });
});

describe('a Heatmap handed days from before the record begins', () => {
  /* The whole record's answer, its record said to begin halfway through its days: the answer a quarter or a year gets
   * when the period starts before the team's first record, with the fixture's own days, whatever day it is run. */
  const ALL = record(ME, new URLSearchParams('period=all'))[1] as RecordRead;
  const days = ALL.agents.state === 'ok' ? ALL.agents.data.days : [];
  const begins = days[Math.floor(days.length / 2)].day;
  const BEGUN: RecordRead = { ...ALL, meta: { ...ALL.meta, coverageFrom: `${begins}T00:00:00Z` } };
  const PATH = recordPath({ period: 'all', page: '1' });
  const drawRecord = (r: RecordRead) => {
    window.history.replaceState(null, '', '/record');
    return wrap(<RecordView served={{ state: 'ok', path: PATH, data: r, team: 'atlas' }} />);
  };

  it('the answer is the case: the period\'s days begin weeks before the record does', () => {
    expect(days[0].day < begins).toBe(true);
    expect(days.filter((d) => d.day < begins).length).toBeGreaterThan(20);
  });

  it('Record\'s calendar draws no cell before the record\'s first day, and names that day', () => {
    drawRecord(BEGUN);
    const cells = calendar()!.days;
    expect(cells[0].date).toBe(begins);
    expect(cells.every((c) => c.date >= begins)).toBe(true);
    expect(cells.at(-1)!.date).toBe(days.at(-1)!.day);
    expect(panel('Every day').textContent).toContain(`Runs started each day from ${formatCalendarDate(begins)}, when the record begins, in UTC`);
  });

  it('Record\'s weekday by hour names the record\'s first day, and draws the hours once a whole week of them was observed', () => {
    drawRecord(BEGUN);
    expect(panel('Weekday by hour').textContent).toContain(`Runs started from ${formatCalendarDate(begins)}, when the record begins, in UTC`);
    expect(hours()).toHaveLength(1);

    heat.props = [];
    const late = iso(Date.parse(BEGUN.meta.asOf) - 3 * DAY);
    drawRecord({ ...BEGUN, meta: { ...BEGUN.meta, coverageFrom: late } });
    expect(hours()).toHaveLength(0);
    expect(text()).toContain('Not a whole week observed yet');
    expect(calendar()!.days.every((c) => c.date >= late.slice(0, 10))).toBe(true);
  });

  it('Record draws no day and no hour of a team with no record at all', () => {
    drawRecord({ ...BEGUN, meta: { ...BEGUN.meta, coverageFrom: null } });
    expect(calendar()).toBeUndefined();
    expect(hours()).toHaveLength(0);
  });

  it('Usage\'s weekday by hour names where the record begins inside its weeks, and draws no hours before a whole week was observed', () => {
    const answer = usage(true);
    const window = answer.rhythm.state === 'ok' ? answer.rhythm.data.window : null;
    const drawUsage = (coverageFrom: string | null) => {
      heat.props = [];
      document.body.innerHTML = '';
      wrap(<PlatformUsageView read={{ state: 'ok', usage: { ...answer, meta: { ...answer.meta, coverageFrom } } as Usage }} />);
    };

    const tenDaysIn = iso(Date.parse(window!.from) + 10 * DAY);
    drawUsage(tenDaysIn);
    expect(hours()).toHaveLength(1);
    expect(panel('Weekday by hour').textContent).toContain(`from ${formatDay(tenDaysIn)}, when the record begins, to ${formatDay(new Date(Date.parse(window!.to) - 1))}`);

    drawUsage(iso(Date.parse(window!.to) - 4 * DAY));
    expect(hours()).toHaveLength(0);
    expect(panel('Weekday by hour').textContent).toContain('Not a whole week observed yet');

    drawUsage(null);
    expect(hours()).toHaveLength(0);

    drawUsage(window!.from);
    expect(hours()).toHaveLength(1);
    expect(panel('Weekday by hour').textContent).toContain(`the weeks of ${formatDay(window!.from)}`);
  });
});
