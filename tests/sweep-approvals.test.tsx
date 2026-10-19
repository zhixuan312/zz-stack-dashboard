import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { dayOf, formatShortDate } from '@/lib/format-date';
import type { Approvals, Home } from '@/lib/work-shapes';
import { approvalsAddress, approvalsPath, filtersOfPath, tabOf, type ApprovalsRead } from '@/views/approvals-context';
import type { HomeRead } from '@/views/home-context';
import { ApprovalsView } from '@/views/pages/approvals';
import { HomeView } from '@/views/pages/home';

/**
 * Approvals and Home count an approval in the week its date is written in (Phase 7's third re-review, Work P-1). A week
 * runs Monday to Monday in the reporting timezone the page writes every date in, so an approval at 06:00 on a Monday
 * there, still the Sunday before in UTC, is that Monday's week: each bar of "Approvals in your name by week" counts the
 * History rows the page dates inside it, and Home's last-week count is that week's bar.
 *
 * The fake's dates are offsets from the moment it started, so its clock is pinned before it is read: at 06:00 on
 * Tuesday 20 Oct in Singapore (22:00 UTC on the Monday), the superadmin's approvals 12, 18 and 24 hours earlier fall at
 * 18:00, 12:00 and 06:00 on Monday 19 Oct, the last of them 22:00 UTC on Sunday 18 Oct.
 */
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-19T22:00:00Z'));
const { approvals } = await import('../scripts/fake-gateway/work-approvals.ts');
const { homeOf } = await import('../scripts/fake-gateway/work-home.ts');
const { ME } = await import('../scripts/fake-gateway/people.ts');
vi.useRealTimers();

const answer = (path: string) => approvals(ME, new URLSearchParams(path.split('?')[1]))[1] as Approvals;
const ok = (path: string): Extract<ApprovalsRead, { state: 'ok' }> => ({ state: 'ok', path, data: answer(path), team: 'atlas' });
/** The approval the clock was pinned for: 06:00 on a Monday in the reporting timezone, the Sunday before in UTC. */
const MONDAY_EARLY = '2026-10-18T22:00:00Z';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
/** The calendar day a cell writes, `19 Oct 2026, 06:00` or `Fri 4 Sept 2026`, as `2026-10-19`. */
function writtenDay(cell: string): string {
  const m = /(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec) (\d{4})/.exec(cell);
  if (!m) throw new Error(`no date written in "${cell}"`);
  return `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function draw(read: ApprovalsRead) {
  const f = filtersOfPath(read.path);
  window.history.replaceState(null, '', approvalsAddress(tabOf(f), Number(f.page)));
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Tooltip.Provider><ApprovalsView served={read} /></Tooltip.Provider></QueryClientProvider>);
}

/** Every History row's date as the page writes it, page after page of ten. */
function historyDays(): string[] {
  const days: string[] = [];
  for (let page = 1; ; page++) {
    const path = approvalsPath({ tab: 'history', page: String(page) });
    const read = ok(path);
    if (read.data.history.state !== 'ok' || !read.data.history.data.rows.length) break;
    draw(read);
    // A row writes one date, its Approved at; a short last page keeps its height with blank rows.
    const rows = [...screen.getByRole('table', { name: 'Approved in your name' }).querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '');
    days.push(...rows.filter((t) => t.trim()).map(writtenDay));
    cleanup();
  }
  return days;
}

/** The chart's bars as drawn: each column's label and value, oldest first. */
function bars(): { label: string; value: number }[] {
  draw(ok(approvalsPath({ tab: 'waiting', page: '1' })));
  const chart = screen.getByText('Approvals in your name by week', { selector: 'caption' }).closest('table')!;
  const out = [...chart.querySelectorAll('tbody tr')].map((tr) => ({ label: tr.querySelector('th')?.textContent ?? '', value: Number(tr.querySelector('td')!.textContent) }));
  cleanup();
  return out;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('one clock for the weeks and the dates', () => {
  const weeks = answer(approvalsPath({ tab: 'waiting', page: '1' })).weeks;

  it('holds the approval this case is about: 06:00 on Monday 19 Oct where the page writes it, Sunday in UTC', () => {
    const all = answer('/approvals?tab=history&limit=100&offset=0');
    expect(all.history.state === 'ok' && all.history.data.rows.map((r) => r.approvedAt)).toContain(MONDAY_EARLY);
    expect(new Date(MONDAY_EARLY).getUTCDay()).toBe(0);
    expect(dayOf(MONDAY_EARLY)).toBe('2026-10-19');
  });

  it('every week\'s bar counts the History rows the page dates in that week', () => {
    const days = historyDays();
    const total = answer(approvalsPath({ tab: 'history', page: '1' })).history;
    expect(days).toHaveLength(total.state === 'ok' ? total.data.total : -1);
    const drawn = bars();
    expect(drawn).toHaveLength(weeks.length);
    const dated = weeks.map((w) => days.filter((d) => d >= dayOf(w.window.from) && d < dayOf(w.window.to)).length);
    drawn.forEach((b, i) => expect(b.label).toContain(formatShortDate(weeks[i].window.from)));
    expect(drawn.map((b) => b.value)).toEqual(dated);
    // The early Monday approval is its own Monday's, with the two later that day; the week before holds none.
    const monday = weeks.findIndex((w) => dayOf(w.window.from) === '2026-10-19');
    expect(drawn[monday].value).toBe(3);
    expect(drawn[monday - 1].value).toBe(0);
  });

  it('Home\'s last-week count is that week\'s bar and its History rows, in its title and its figure', () => {
    const home: Home = homeOf('atlas', ME.email);
    const last = weeks.findIndex((w) => w.window.from === home.tiles.closed.window.from);
    expect(last).toBeGreaterThanOrEqual(0);
    const bar = bars()[last].value;
    const w = weeks[last].window;
    expect(bar).toBe(historyDays().filter((d) => d >= dayOf(w.from) && d < dayOf(w.to)).length);
    const said = /(\d+) approvals? recorded in your name last week/.exec(home.title.sentence);
    expect(said && Number(said[1])).toBe(bar);
    const read: HomeRead = { state: 'ok', home, team: 'atlas' };
    render(<SurfaceOverride surface={{}}><Tooltip.Provider><HomeView read={read} /></Tooltip.Provider></SurfaceOverride>);
    const mine = [...document.querySelectorAll('[data-figures] [data-figure]')].find((h) => h.textContent?.includes('Approvals in your name · last week'))!;
    expect(mine.querySelector('[data-value]')!.textContent).toBe(String(bar));
  });
});
