import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The fake gateway's clock is the moment its module loads. A Monday afternoon in UTC is a Monday night in the console's
// timezone, so the newest release, tagged 20 hours before, is Monday in Singapore and still Sunday in UTC: the hour the
// review's render straddled. 5 Oct, the last whole week, is a day whose padded and unpadded forms differ.
vi.hoisted(() => { vi.useFakeTimers({ now: new Date('2026-10-12T14:21:00Z'), toFake: ['Date'] }); });

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace(url: string) { window.history.replaceState(null, '', url); } }),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));

import { app } from '@/app.config';
import { SurfaceOverride } from '@/components/base/surface';
import type { Me } from '@/lib/api-shapes';
import { dayOf, formatDay, formatShortDate } from '@/lib/format-date';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { BUGS_DEFAULTS, bugsPath, lastWhole } from '@/views/platform-bugs-context';
import { RELEASES_DEFAULTS, clientActionOf, releaseContext, releasesPath, type ReleasesRead } from '@/views/platform-releases-context';
import { pairOf, statusRead } from '@/views/platform-status-context';
import { bugs } from '../scripts/fake-gateway/platform-bugs.ts';
import { releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';

/**
 * The findings of "Phase 7, I-129 re-review: the Platform destinations after I-151 to I-157" on Status, Releases, a
 * release and Bugs, each as the cause it was traced to: the Releases table's last column was one a narrow table hides,
 * so the column it does show never took the card's padding (F-8); the fake counted a release in the UTC week its tag
 * fell in while the table prints its day in the console's timezone, and the Last week tile counted seven days rather
 * than the week the chart marks (N-2); a word in a window started with a capital mid-sentence and wrapped, and a release
 * whose action is unknown said two colons (N-5); the median chart drew a running week whose word no phone column holds
 * (F-15); and a day was padded in a sentence or unpadded on an axis or in a table cell (N-4).
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

function browser() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (String(input).endsWith('/me')
    ? Promise.resolve({ ok: true, status: 200, json: async () => SUPERADMIN } as unknown as Response)
    : new Promise(() => {}))));
}
function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
const tableNamed = (name: string) => screen.getByRole('table', { name });
/** A release's row, by the version its first cell leads with. */
const releaseRow = (table: HTMLElement, version: string) => within(table).getAllByRole('row').find((r) => r.querySelector('td .font-mono')?.textContent === version)!;
/** The card a heading titles. */
const cardOf = (name: string) => screen.getByRole('heading', { name }).closest('section, .card') as HTMLElement;
/** A tile, by the label it starts with. */
const tile = (label: string) => [...document.querySelectorAll<HTMLElement>('[data-split="tiles"] > .card')].find((c) => c.textContent!.startsWith(label))!;

beforeEach(() => { gateway.get.mockReset(); browser(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('Releases and a release', () => {
  const LIST = releases(10, 0);
  const ROWS = LIST.rows.state === 'ok' ? LIST.rows.data.rows : [];
  const served: ReleasesRead = { state: 'ok', path: releasesPath(RELEASES_DEFAULTS), data: LIST };
  const table = () => tableNamed('Releases with what was observed either side of each');
  const [NEWEST, , , QUIET, OLDEST] = ROWS.map((r) => r.version);

  it('ends the table with a column no width hides, so the column it shows takes the card\'s padding (F-8)', () => {
    mount(<PlatformReleasesView served={served} />);
    const headers = [...table().querySelectorAll('thead th')];
    const last = headers.at(-1)!;
    expect(last.textContent).toBe('Malformed per 1,000');
    expect(last.className).not.toMatch(/hidden/);
    for (const row of table().querySelectorAll('tbody tr')) expect(row.lastElementChild!.className).not.toMatch(/hidden/);
  });

  it('holds every side of a window on one line, a word as a figure is, after its label and in lower case (F-8, N-5)', () => {
    mount(<PlatformReleasesView served={served} />);
    const sides = [...table().querySelectorAll<HTMLElement>('[data-side]')];
    expect(sides.length).toBeGreaterThan(0);
    for (const s of sides) expect(s.classList, s.textContent!).toContain('whitespace-nowrap');
    const text = (v: string) => [...releaseRow(table(), v).querySelectorAll('td:not([data-mobile="title"]) [data-side]')].map((s) => s.textContent);
    expect(text(OLDEST)).toContain('Before not observed');
    expect(text(QUIET)).toContain('After no calls');
    expect(text(NEWEST)[0]).toMatch(/^Before \d/);
  });

  it('writes a phone card\'s words in lower case mid-sentence and says an unknown action once (N-5)', () => {
    mount(<PlatformReleasesView served={served} />);
    const title = (v: string) => releaseRow(table(), v).querySelector('td[data-mobile="title"]')!.textContent!;
    expect(title(QUIET)).toMatch(/[\d.]+ before; no calls after/);
    expect(title(OLDEST)).toMatch(/not observed before; [\d.]+ after \(partial\)/);
    expect(title(OLDEST)).toContain('Clients: Not recorded');
    const clients = [...table().querySelectorAll('td[data-mobile="title"] span')].map((l) => l.textContent!).filter((t) => t.startsWith('Clients:'));
    expect(clients).toHaveLength(ROWS.length);
    for (const line of clients) expect(line.split(':')).toHaveLength(2);
    expect(clientActionOf(ROWS.find((r) => r.version === OLDEST)!)).toBe('Not recorded');
  });

  it('says on a release\'s own page and to the assistant that the action is not recorded (N-5)', () => {
    const r = releaseDetail(OLDEST)!;
    mount(<PlatformReleaseView version={OLDEST} served={{ state: 'ok', data: r }} />);
    expect(document.body.textContent).toContain('Not recorded');
    expect(document.body.textContent).not.toMatch(/Unknown/);
    const told = JSON.stringify(releaseContext(r, { asOf: LIST.meta.asOf }));
    expect(told).not.toMatch(/Unknown/);
  });

  it('counts each release in the week whose days hold the day its table prints (N-2)', () => {
    const day = (iso: string) => dayOf(iso, app.timezone);
    for (const r of ROWS) {
      const holding = LIST.weeks.filter((w) => day(w.window.from) <= day(r.releasedAt) && day(r.releasedAt) < day(w.window.to));
      if (!holding.length) continue;
      expect(holding).toHaveLength(1);
    }
    for (const w of LIST.weeks) {
      const printed = ROWS.filter((r) => day(w.window.from) <= day(r.releasedAt) && day(r.releasedAt) < day(w.window.to)).length;
      expect(w.releases, `the week of ${day(w.window.from)}`).toBe(printed);
    }
    // The newest is tagged on Monday where the console prints it, Sunday in UTC: the running week holds it.
    expect(day(ROWS[0].releasedAt)).toBe(day(LIST.weeks.at(-1)!.window.from));
    expect(LIST.weeks.at(-1)!.releases).toBeGreaterThan(0);
  });

  it('counts the Last week tile as the whole week the chart marks, and names that week (N-2)', () => {
    const whole = LIST.weeks.at(-2)!;
    expect(whole.window.complete).toBe(true);
    expect(LIST.tiles.lastWeek).toBe(whole.releases);
    mount(<PlatformReleasesView served={served} />);
    expect(tile('Last week').textContent).toMatch(new RegExp(`${whole.releases}\\s*releases?`));
    expect(tile('Last week').textContent).toContain(`Week of ${formatDay(whole.window.from)}`);
  });
});

describe('Status', () => {
  const draw = () => mount(<PlatformStatusView read={statusRead(PLATFORM_STATUS)} />);
  const malformed = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!;
  const fiveOct = malformed.weeks.find((w) => formatDay(w.window.from) !== formatShortDate(w.window.from))!;

  it('pads every day on the Featured metric\'s axes, as an axis writes one (N-4)', () => {
    expect(fiveOct).toBeTruthy();
    const [m, f] = pairOf(PLATFORM_STATUS);
    for (const h of [m, f]) for (const c of h.columns) expect(c.label).toBe(formatShortDate(c.key));
    expect(m.columns.map((c) => c.label)).toContain(formatShortDate(fiveOct.window.from));
  });

  it('pads a week\'s day in a scoreboard cell and writes it unpadded in the phone card\'s sentence (N-4)', () => {
    draw();
    const said: string[] = [];
    for (const name of ['Five measures with a direction, each against the week before', 'Three activity measures, each against the week before']) {
      for (const td of tableNamed(name).querySelectorAll('tbody td')) {
        const phone = td.querySelector(':scope > span.hidden');
        const cell = phone ? [...td.childNodes].filter((n) => n !== phone).map((n) => n.textContent).join('') : td.getAttribute('data-mobile') === 'fact' ? '' : td.textContent!;
        for (const m of cell.matchAll(/Week of (\d+) /g)) said.push(m[1]);
        for (const m of (phone?.textContent ?? '').matchAll(/week of (\d+) /g)) expect(m[1], phone!.textContent!).not.toMatch(/^0/);
      }
    }
    expect(said.length).toBeGreaterThan(0);
    for (const d of said) expect(d).toMatch(/^\d{2}$/);
    expect(said.some((d) => d.startsWith('0'))).toBe(true);
  });
});

describe('Status\'s doors', () => {
  it('pads a door\'s last fault day in its cell and writes it unpadded in the phone card\'s sentence (N-4)', () => {
    const doors = PLATFORM_STATUS.doors.state === 'ok' ? PLATFORM_STATUS.doors.data : [];
    const faulted = doors.find((d) => d.totals.lastFaultDay)!;
    expect(faulted.totals.lastFaultDay).toMatch(/-0\d$/);
    mount(<PlatformStatusView read={statusRead(PLATFORM_STATUS)} />);
    const row = within(tableNamed('Each door\'s fault days and its run of days under 1% tool failures')).getAllByRole('row')
      .find((r) => r.textContent!.includes(faulted.finding.text))!;
    const [, day] = /-(\d{2})$/.exec(faulted.totals.lastFaultDay!)!;
    expect(row.textContent).toMatch(new RegExp(`${day} \\w+ \\d{4}`));
    const phone = [...row.querySelectorAll('td > span.hidden')].map((s) => s.textContent!).join(' ');
    expect(phone).toMatch(new RegExp(`last ${Number(day)} [A-Z]`));
  });
});

describe('Bugs', () => {
  const ADMIN = bugs(true, { state: null, impact: null, surface: null }, 10, 0);
  const served = { state: 'ok' as const, path: bugsPath(BUGS_DEFAULTS), data: ADMIN };

  it('draws the median by week over whole weeks only, so no phone column holds a running week\'s word (F-15)', () => {
    mount(<PlatformBugsView served={served} />);
    const card = cardOf('Median hours to resolve by week filed');
    expect(card.querySelector('[data-running]')).toBeNull();
    expect(card.textContent).not.toMatch(/so far/);
    const weeks = within(card).getByRole('table', { name: 'Median hours to resolve by week filed' }).querySelectorAll('tbody tr');
    expect(weeks.length).toBeGreaterThan(0);
    for (const r of weeks) expect(r.querySelector('th')!.textContent).not.toMatch(new RegExp(`^${formatShortDate(ADMIN.cohorts.at(-1)!.week)}`));
  });

  it('writes the rate tile\'s week as a sentence writes a day (N-4)', () => {
    mount(<PlatformBugsView served={served} />);
    const week = lastWhole(ADMIN.cohorts, ADMIN.meta.asOf)!;
    expect(tile('Reports per 1,000').textContent).toContain(`Week of ${formatDay(week.week)}`);
  });
});
