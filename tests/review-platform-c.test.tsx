import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { formatDate, formatDay } from '@/lib/format-date';
import type { Finding, PlatformStatus } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { filtersOfPath } from '@/views/platform-bugs-context';
import { platformStatusContext, statusRead } from '@/views/platform-status-context';

/**
 * The three findings of "Phase 7, I-129: a non-builder's review of the Platform destinations" whose words the gateway
 * writes (F-1, F-5, F-6), held against the fake, which writes them as the gateway does: every day a platform sentence
 * carries is the day the console's own formatter writes (`formatDay` in a sentence, `formatDate` in a withheld report's
 * title, as the queue's Filed column draws it); what needs attention about open reports opens Bugs filtered to open; and
 * Status says the latest tag beside the version it runs where the two differ, and nothing more where they agree.
 *
 * DELIBERATE: the fake's clock is the moment its modules load. It is pinned at 19 October 2026 before the fake is
 * imported, so its first weeks fall in September, the month whose short name the gateway once wrote differently from
 * the console ("Sep" against "Sept"), whatever day the test runs.
 */
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-19T04:00:00Z'));
const { MEMBER_STATUS, PLATFORM_STATUS } = await import('../scripts/fake-gateway/platform-status.ts');
const { bugs, statusFor } = await import('../scripts/fake-gateway/platform-bugs.ts');
const { releases } = await import('../scripts/fake-gateway/platform-releases.ts');
const { homeOf } = await import('../scripts/fake-gateway/work-home.ts');
const { ME } = await import('../scripts/fake-gateway/people.ts');
vi.useRealTimers();

function browser() {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
}
function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}

beforeEach(() => { browser(); });
afterEach(() => { vi.unstubAllGlobals(); });

/** Every day a sentence names, `14 Sept` or `1 Oct`. */
const daysIn = (text: string): string[] => [...text.matchAll(/\b\d{1,2} [A-Z][a-z]{2,3}\b/g)].map((m) => m[0]);
/** Where a finding names a day the console would not write so: each day its text names must be one of its dates. */
function strayDays(f: Finding | null): string[] {
  if (!f) return [];
  const said = new Set(f.dates.map((d) => formatDay(d)));
  return daysIn(f.text).filter((d) => !said.has(d));
}
/** Whether a day with no date beside it is one the console writes: that day of some month, as `formatDay` writes it. */
const consoleWrites = (d: string): boolean =>
  Array.from({ length: 12 }, (_, m) => formatDay(new Date(Date.UTC(2026, m, Number(d.split(' ')[0]), 4)))).includes(d);
const LATEST = releases(10, 0).tiles.latest!.version;
const runningData = (s: PlatformStatus) => (s.running.state === 'ok' ? s.running.data : null)!;
const runningPanel = () => screen.getByRole('heading', { name: 'What is running' }).closest('section, .card') as HTMLElement;

describe('the days the platform\'s sentences carry (F-6)', () => {
  it('writes every day of Status\'s findings as the console writes the same day', () => {
    const findings = [
      ...PLATFORM_STATUS.measures.map((m) => m.finding),
      ...(PLATFORM_STATUS.doors.state === 'ok' ? PLATFORM_STATUS.doors.data.map((d) => d.finding) : []),
    ];
    expect(findings.some((f) => f && daysIn(f.text).some((d) => d.endsWith('Sept')))).toBe(true);
    for (const f of findings) expect(strayDays(f), f?.text).toEqual([]);
  });

  it('writes the days of what needs attention as the console writes them', () => {
    for (const s of [PLATFORM_STATUS, MEMBER_STATUS]) {
      document.body.innerHTML = '';
      mount(<PlatformStatusView read={statusRead(s)} />);
      const said = new Set(s.needs.rows.flatMap((r) => (r.oldestAt ? [formatDay(r.oldestAt)] : [])));
      const list = screen.getByRole('list', { name: 'What needs attention' });
      expect(daysIn(list.textContent!).length).toBeGreaterThan(0);
      for (const d of daysIn(list.textContent!)) expect(said.has(d), d).toBe(true);
    }
  });

  it('writes the days of Home\'s title and findings as the console writes them', () => {
    for (const team of ['atlas', 'beacon']) {
      const h = homeOf(team, ME.email);
      for (const d of daysIn(h.title.sentence)) expect(consoleWrites(d), d).toBe(true);
      for (const part of [h.words, h.approvals]) if (part.state === 'ok') expect(strayDays(part.data.finding), part.data.finding?.text).toEqual([]);
    }
  });

  it('writes a withheld report\'s filed day as the queue\'s Filed column draws it', () => {
    const queue = bugs(false, { state: null, impact: null, surface: null }, 100, 0).queue;
    const rows = queue.state === 'ok' ? queue.data.rows : [];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.title.endsWith(`, filed ${formatDate(r.filedAt)}`), r.title).toBe(true);
  });

  it('never writes September as "Sep" anywhere the fake speaks', () => {
    const said = JSON.stringify([PLATFORM_STATUS, MEMBER_STATUS, homeOf('atlas', ME.email), bugs(false, { state: null, impact: null, surface: null }, 100, 0)]);
    expect(said).not.toMatch(/\b\d{1,2} Sep\b/);
  });
});

describe('what needs attention about open reports (F-5)', () => {
  it('opens Bugs filtered to open, for the superadmin and a member, as the fixture and the server answer it', () => {
    for (const s of [PLATFORM_STATUS, MEMBER_STATUS, statusFor(true, 'atlas'), statusFor(false, 'atlas')]) {
      const row = s.needs.rows.find((r) => r.kind === 'bugs')!;
      expect(row.href).not.toBeNull();
      expect(new URL(row.href!, 'http://console').pathname).toBe('/platform/bugs');
      expect(filtersOfPath(row.href!).state).toBe('open');
    }
  });

  it('draws that row as a link to the filtered queue', () => {
    mount(<PlatformStatusView read={statusRead(PLATFORM_STATUS)} />);
    const list = screen.getByRole('list', { name: 'What needs attention' });
    const item = within(list).getAllByRole('listitem').find((li) => li.textContent!.includes('Bug reports are open'))!;
    const link = within(item).getByRole('link');
    expect(filtersOfPath(link.getAttribute('href')!).state).toBe('open');
    expect(link.querySelector('[data-goes]')).not.toBeNull();
  });
});

describe('what is running beside the latest tag (F-1)', () => {
  it('answers the latest tag Releases leads with', () => {
    expect(runningData(PLATFORM_STATUS).latest).toBe(LATEST);
    expect(LATEST).not.toBe(runningData(PLATFORM_STATUS).platform);
  });

  it('says the latest tag beside the running version where they differ, on the page and to the assistant', () => {
    const { platform } = runningData(PLATFORM_STATUS);
    const sentence = `${LATEST} is tagged; the platform runs ${platform}`;
    mount(<PlatformStatusView read={statusRead(PLATFORM_STATUS)} />);
    expect(runningPanel().textContent).toContain(sentence);
    expect(contextText(platformStatusContext(statusRead(PLATFORM_STATUS)))).toContain(sentence);
  });

  it('says nothing more where the latest tag is the running one', () => {
    const data = runningData(PLATFORM_STATUS);
    const same: PlatformStatus = { ...PLATFORM_STATUS, running: { state: 'ok', data: { ...data, latest: data.platform } } };
    mount(<PlatformStatusView read={statusRead(same)} />);
    expect(runningPanel().textContent).not.toMatch(/is tagged;/);
    expect(contextText(platformStatusContext(statusRead(same)))).not.toMatch(/is tagged;/);
  });
});
