import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/platform',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh: router.refresh, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', () => ({ gatewayGet: gateway.get }));
vi.mock('@/data/access', async (load) => ({ ...(await load<typeof import('@/data/access')>()), requireNeed: async () => {} }));

import { nav, refusal, workspaces } from '@/app.config';
import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { MAIN_ROLES, effective, whoCan } from '@/data/roles';
import type { Measure, PlatformStatus } from '@/lib/platform-shapes';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { contextText } from '@/lib/shared-context';
import { PlatformStatusAsOf, PlatformStatusView } from '@/views/pages/platform-status';
import { CONTEXT_BUDGET, READ_BOUND_MS } from '@/views/context';
import { platformStatusContext, statusRead, type StatusRead } from '@/views/platform-status-context';
import { platformStatusTool } from '@/views/tools/platform-status';
import { navOf, workspaceOf } from '@/views/workspaces';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { readStatus } from '../app/(dash)/platform/read-status';
import PlatformStatusLoading from '../app/(dash)/platform/loading';

/**
 * The Platform workspace's Status page: what needs attention, the paired figures, the reader's own team's share, the
 * scoreboard, the doors and what is running, all drawn from the read the page makes on the console's server. The figures
 * come from the fake gateway's own answer, the one `pnpm verify` serves the page, and each state is that answer with
 * one part changed, as the gateway would answer it.
 */
const measure = (s: PlatformStatus, key: Measure['key']) => s.measures.find((m) => m.key === key)!;
const MALFORMED = measure(PLATFORM_STATUS, 'malformed_per_1000');
const FOLLOWUP = measure(PLATFORM_STATUS, 'same_tool_followup_pct');
const DOORS = PLATFORM_STATUS.doors.state === 'ok' ? PLATFORM_STATUS.doors.data : [];
const ok = (s: PlatformStatus): StatusRead => statusRead(s);
const withMeasure = (key: Measure['key'], change: Partial<Measure>): PlatformStatus =>
  ({ ...PLATFORM_STATUS, measures: PLATFORM_STATUS.measures.map((m) => (m.key === key ? { ...m, ...change } : m)) });

/** The view as the shell holds it: inside the tooltip provider, on the console's surface, with an assistant when `ask` is given. */
const draw = (read: StatusRead, ask?: (q: string) => void) =>
  render(<SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider><PlatformStatusView read={read} /></Tooltip.Provider></SurfaceOverride>);
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section, .card') as HTMLElement;
const row = (table: HTMLElement, name: string) => within(table).getAllByText(name, { selector: 'td, td *' })[0].closest('tr')!;

beforeEach(() => router.refresh.mockReset());
afterEach(() => vi.useRealTimers());

describe('who opens Status', () => {
  it('needs platform:read, which both roles hold', () => {
    expect(FEATURES['platform-status']).toEqual({ title: 'Status', needs: 'platform:read' });
    expect(whoCan('platform:read')).toEqual(['Superadmin', 'Member']);
    for (const role of MAIN_ROLES) expect(effective(role).has('platform:read'), role).toBe(true);
  });

  it('is the Platform workspace, Status in Health', () => {
    expect(workspaces.platform).toEqual({ label: 'Platform', audience: 'The platform itself', homeHref: '/platform' });
    expect(navOf('platform').flatMap((g) => g.items.map((i) => [i.label, i.href]))).toContainEqual(['Status', '/platform']);
    expect(nav.flatMap((g) => g.items).find((i) => i.href === '/platform')!.needs).toBe(FEATURES['platform-status'].needs);
    expect(workspaceOf('/platform')).toBe('platform');
  });
});

describe('what needs attention', () => {
  it('leads with the superadmin\'s headline, five rows at most, each linked with an arrow, and no foot that repeats the headline', () => {
    draw(ok(PLATFORM_STATUS));
    const list = screen.getByRole('list', { name: 'What needs attention' });
    expect(screen.getByRole('heading', { name: '5 things need you' })).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(PLATFORM_STATUS.needs.rows.length);
    expect(PLATFORM_STATUS.needs.rows.length).toBeLessThanOrEqual(5);
    for (const r of PLATFORM_STATUS.needs.rows) expect(within(list).getByText(r.detail)).toBeInTheDocument();
    expect(document.querySelector('[data-needs-foot]')).toBeNull();
    // Each row with a released destination links to its page, the whole row, with the arrow that says so.
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/platform/bugs?state=open', '/platform/usage', '/platform/usage', '/platform/evaluation', '/platform/teams/atlas']);
    expect(within(list).getByText('Approvals are waiting in atlas')).toBeInTheDocument();
    expect(within(list).getByText('1 revision was presented 14 days ago or more and not approved')).toBeInTheDocument();
  });

  it('counts what the five rows left out, by kind, in the foot', () => {
    draw(ok({ ...PLATFORM_STATUS, needs: { ...PLATFORM_STATUS.needs, total: 6, knownCount: 6, overflowByKind: { approvals: 1 }, headline: '6 things need you' } }));
    expect(screen.getByRole('heading', { name: '6 things need you' })).toBeInTheDocument();
    expect(document.querySelector('[data-needs-foot]')!.textContent).toBe('1 more not shown: approvals 1.');
  });

  it('is worded for a member: what is known and open, the teams\' approvals one row that links nowhere', () => {
    draw(ok(MEMBER_STATUS));
    expect(screen.getByRole('heading', { name: '5 things are known and open' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'What needs attention' });
    expect(within(list).getByText('Approvals are waiting in 1 team')).toBeInTheDocument();
    expect(within(list).getByText('1 team has a revision presented 14 days ago or more and not approved')).toBeInTheDocument();
    expect(within(list).queryAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/platform/bugs?state=open', '/platform/usage', '/platform/usage', '/platform/evaluation']);
    expect(within(list).getByText('Approvals are waiting in 1 team').closest('a')).toBeNull();
    expect(list.querySelectorAll('[data-goes]')).toHaveLength(4);
    expect(document.querySelector('[data-needs-foot]')).toBeNull();
  });

  it('never reads as nothing open when a check did not answer, and names the check', () => {
    const needs = { ...PLATFORM_STATUS.needs, state: 'partial' as const, total: null, unavailableKinds: ['evaluation' as const], headline: '5 known issues; some checks unavailable' };
    draw(ok({ ...PLATFORM_STATUS, needs }));
    expect(screen.getByRole('heading', { name: '5 known issues; some checks unavailable' })).toBeInTheDocument();
    expect(document.querySelector('[data-needs-foot]')!.textContent).toContain('Not checked: evaluation.');
  });

  it('says a complete empty check found nothing, and an unanswered one says nothing either way', () => {
    const { unmount } = draw(ok({ ...PLATFORM_STATUS, needs: { state: 'complete', rows: [], total: 0, knownCount: 0, unavailableKinds: [], overflowByKind: {}, headline: 'Nothing needs you' } }));
    expect(screen.getAllByText('Nothing needs you').length).toBeGreaterThan(0);
    expect(screen.queryByRole('list', { name: 'What needs attention' })).toBeNull();
    unmount();
    draw(ok({ ...PLATFORM_STATUS, needs: { state: 'unavailable', rows: [], total: null, knownCount: 0, unavailableKinds: ['bugs', 'door', 'evaluation', 'approvals', 'drift'], overflowByKind: {}, headline: 'Status checks unavailable' } }));
    expect(screen.getByRole('heading', { name: 'Status checks unavailable' })).toBeInTheDocument();
    expect(screen.queryByText(/Nothing needs you|No known open issues/)).toBeNull();
  });
});

describe('the paired figures', () => {
  it('are one Featured metric of two halves, each its last whole week with its caption and the gateway\'s finding', () => {
    const { container } = draw(ok(PLATFORM_STATUS));
    const halves = container.querySelectorAll('[data-figures] [data-figure]');
    expect(halves).toHaveLength(2);
    const last = MALFORMED.last!;
    expect(halves[0].querySelector('[data-value]')!.textContent).toBe((1000 * last.numerator! / last.denominator!).toFixed(1));
    expect(halves[0].textContent).toContain(`Real-work calls, week of ${formatDay(last.window.from)}, up 44.0 on the week before`);
    expect(halves[0].querySelector('[data-finding]')!.textContent).toBe(MALFORMED.finding!.text);
    const f = FOLLOWUP.last!;
    expect(halves[1].querySelector('[data-value]')!.textContent).toBe(`${(100 * f.numerator! / f.denominator!).toFixed(1)}%`);
    expect(halves[1].textContent).toContain(`${f.numerator} of ${f.denominator} refusals that could be followed were put right`);
    expect(halves[1].querySelector('[data-finding]')!.textContent).toBe(FOLLOWUP.finding!.text);
  });

  it('draws each by week, a week with no data as none and the running week as unfinished, never a zero', () => {
    const { container } = draw(ok(PLATFORM_STATUS));
    const chart = container.querySelectorAll('[data-figures] [data-figure]')[0];
    const columns = chart.querySelectorAll('[data-column]');
    expect(columns).toHaveLength(MALFORMED.weeks.length);
    MALFORMED.weeks.forEach((w, i) => expect(columns[i].hasAttribute('data-no-data'), w.window.from).toBe(w.figure.value === null));
    expect(columns[columns.length - 1].hasAttribute('data-running')).toBe(true);
  });

  it('feet the best week for malformed calls, the days in a row with work and every door\'s tool failures summed with their calls', () => {
    const { container } = draw(ok(PLATFORM_STATUS));
    const foot = container.querySelector('[data-foot]')!;
    const best = MALFORMED.best!;
    expect(foot.textContent).toContain(`${best.figure.value!.toFixed(1)}, week of ${formatDay(best.window.from)}`);
    expect(PLATFORM_STATUS.records.state).toBe('ok');
    if (PLATFORM_STATUS.records.state === 'ok') expect(foot.textContent).toContain(`Days in a row with work${PLATFORM_STATUS.records.data.daysWithWork}`);
    const failures = DOORS.reduce((n, d) => n + d.totals.toolFailures, 0), calls = DOORS.reduce((n, d) => n + d.totals.calls, 0);
    expect(foot.textContent).toContain(`${failures} in ${calls.toLocaleString('en-US')} calls`);
  });

  it('holds Ask in the Featured metric\'s head with the assistant on, and draws none with it off', () => {
    const asked = vi.fn();
    const { unmount } = draw(ok(PLATFORM_STATUS), asked);
    const ask = screen.getByRole('button', { name: /^Ask: / });
    const featured = ask.closest('section')!;
    expect(featured.querySelector('[data-figures]')).not.toBeNull();
    expect(featured.firstElementChild!.contains(ask)).toBe(true);
    fireEvent.click(ask);
    expect(asked).toHaveBeenCalledWith(`What do malformed calls per 1,000 and refusals put right in the week of ${formatDay(MALFORMED.last!.window.from)} say about how real work calls tools?`);
    unmount();
    draw(ok(PLATFORM_STATUS));
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('the scoreboard', () => {
  it('counts the five directional measures better than the week before, and keeps the three activity measures apart', () => {
    draw(ok(PLATFORM_STATUS));
    const better = PLATFORM_STATUS.measures.filter((m) => m.better !== 'neutral' && m.judgement === 'improved').length;
    expect(screen.getByText(`${better} of 5 measures are better than the week before`)).toBeInTheDocument();
    const directional = card('The scoreboard');
    for (const label of ['Malformed calls per 1,000', 'Refusals put right', 'Median call duration', '95th percentile call duration', 'Searches that found something']) {
      expect(row(directional, label)).toBeTruthy();
    }
    const activity = card('Activity');
    expect(within(activity).getAllByRole('row')).toHaveLength(4);
    for (const label of ['Bug reports per 1,000 calls', 'Sessions', 'Work finished']) expect(row(activity, label)).toBeTruthy();
    expect(within(directional).queryByText('Sessions')).toBeNull();
  });

  it('changes a rate in its per-1,000 unit and a count in percent, never a percentage from a zero week', () => {
    draw(ok(PLATFORM_STATUS));
    const rate = row(card('The scoreboard'), 'Malformed calls per 1,000');
    const diff = (MALFORMED.last!.figure.value! - MALFORMED.previous!.figure.value!).toFixed(1);
    expect(rate.textContent).toContain(diff);
    expect(rate.textContent).not.toMatch(new RegExp(`${diff}%`));
    const sessions = measure(PLATFORM_STATUS, 'sessions');
    const pct = (100 * (sessions.last!.figure.value! - sessions.previous!.figure.value!) / sessions.previous!.figure.value!).toFixed(1);
    expect(row(card('Activity'), 'Sessions').textContent).toContain(`${pct}%`);
  });

  it('draws a change from a zero week as the absolute change', () => {
    const sessions = measure(PLATFORM_STATUS, 'sessions');
    const zero = { ...sessions.previous!, figure: { value: 0, why: null }, numerator: 0 };
    draw(ok(withMeasure('sessions', { previous: zero })));
    const cells = row(card('Activity'), 'Sessions');
    expect(cells.textContent).toContain(String(sessions.last!.figure.value));
    expect(cells.textContent).not.toMatch(/%/);
  });

  it('says a measure that does not compare is not comparable, and a missing week is no data, never zero', () => {
    const searches = measure(PLATFORM_STATUS, 'searches_with_results_pct');
    draw(ok(withMeasure('searches_with_results_pct', { judgement: 'not_comparable', last: { ...searches.last!, figure: { value: null, why: 'no_data' } } })));
    const cells = row(card('The scoreboard'), 'Searches that found something');
    expect(cells.textContent).toContain('Not comparable');
    expect(cells.textContent).toContain('No data');
  });
});

describe('the doors', () => {
  it('draws one row a door with its days with calls, fault days, last fault day and the gateway\'s run sentence', () => {
    draw(ok(PLATFORM_STATUS));
    const doors = card('The doors');
    expect(within(doors).getAllByRole('row')).toHaveLength(DOORS.length + 1);
    for (const d of DOORS) {
      const r = row(doors, d.door);
      expect(r.textContent).toContain(d.finding.text);
      expect(r.textContent).toContain(String(d.totals.faultDays));
    }
    expect(row(doors, 'eval').textContent).toContain('None recorded');
    expect(row(doors, 'core').textContent).not.toContain('None recorded');
  });

  it('says a door with fewer than two days with calls has not enough days, and no door at all is its zero state', () => {
    const core = DOORS.find((d) => d.door === 'core')!;
    const quiet = { ...core, days: core.days.map((d, i) => (i === 0 ? d : { ...d, calls: 0, toolFailures: 0, state: 'none' as const })) };
    const { unmount } = draw(ok({ ...PLATFORM_STATUS, doors: { state: 'ok', data: [quiet] } }));
    expect(row(card('The doors'), 'core').textContent).toContain('Not enough days');
    unmount();
    draw(ok({ ...PLATFORM_STATUS, doors: { state: 'ok', data: [] } }));
    expect(screen.getByText('No door has recorded a call')).toBeInTheDocument();
  });
});

describe('what is running, and the reader\'s own team', () => {
  it('draws the running versions, or says the running version is unrecorded', () => {
    const { unmount } = draw(ok(PLATFORM_STATUS));
    const running = card('What is running');
    expect(PLATFORM_STATUS.running.state).toBe('ok');
    if (PLATFORM_STATUS.running.state === 'ok') expect(within(running).getByText(PLATFORM_STATUS.running.data.platform)).toBeInTheDocument();
    unmount();
    draw(ok({ ...PLATFORM_STATUS, running: { state: 'unavailable', reason: 'unrecorded' } }));
    expect(card('What is running').textContent).toMatch(/unrecorded/);
  });

  it('draws the team\'s three tiles and one line of its bug counts', () => {
    draw(ok(PLATFORM_STATUS));
    for (const label of ['Your team\'s malformed calls per 1,000', 'Your team\'s refusals put right', 'Your team\'s sessions']) expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    expect(PLATFORM_STATUS.own.state).toBe('ok');
    if (PLATFORM_STATUS.own.state !== 'ok') return;
    const b = PLATFORM_STATUS.own.data.bugs;
    expect(document.querySelector('[data-own-bugs]')!.textContent).toBe(`Your team's bug reports: ${b.filed} filed, ${b.fixed} fixed, ${b.notABug} not a bug, ${b.duplicate} duplicate, ${b.open} open.`);
  });

  it('calls nothing operational or uptime, and agents\' activity nobody\'s workday', () => {
    const { container } = draw(ok(PLATFORM_STATUS));
    const text = `${container.textContent} ${contextText(platformStatusContext(ok(PLATFORM_STATUS)))}`;
    expect(text).not.toMatch(/operational|uptime|workday|working day|day off|healthy/i);
  });
});

describe('the page\'s states', () => {
  it('loading: the page\'s shape, announced once as busy, naming the page only where the refusal lets it', () => {
    render(<Wrap><PlatformStatusLoading /></Wrap>);
    expect(screen.getByRole('status', { name: refusal === 'absent' ? 'Loading page' : 'Loading status' })).toHaveAttribute('aria-busy', 'true');
  });

  it('empty: a fresh platform draws every part with nothing in it, and no zero for a week that held nothing', () => {
    const none = (m: Measure): Measure => ({ ...m, weeks: m.weeks.map((w) => ({ ...w, figure: { value: null, why: 'no_data' }, numerator: null, denominator: null })), first: null, best: null, last: null, previous: null, highest: null, lowest: null, judgement: 'not_comparable', finding: null });
    const fresh: PlatformStatus = {
      ...PLATFORM_STATUS,
      needs: { state: 'complete', rows: [], total: 0, knownCount: 0, unavailableKinds: [], overflowByKind: {}, headline: 'Nothing needs you' },
      measures: PLATFORM_STATUS.measures.map(none),
      records: { state: 'ok', data: { daysWithWork: 0, daysUnderOnePercent: 0, longestUnderOnePercent: null } },
      doors: { state: 'ok', data: [] },
    };
    const { container } = draw(ok(fresh));
    expect(screen.getAllByText('Nothing needs you').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-figures] [data-value]')[0].textContent).toBe('—');
    expect(container.querySelectorAll('[data-figures] [data-figure]')[0].textContent).toContain('No whole week has ended since the record began.');
    expect(screen.getByText('No door has recorded a call')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-figures] [data-column]:not([data-no-data])')).toHaveLength(0);
  });

  it('partial: a part that is unavailable draws its own unavailable state and the rest stands', () => {
    draw(ok({ ...PLATFORM_STATUS, doors: { state: 'unavailable', reason: 'the doors\' days did not answer' }, own: { state: 'unavailable', reason: 'the team\'s counts did not answer' } }));
    expect(screen.getByText('The doors: unavailable')).toBeInTheDocument();
    expect(screen.getByText('Your team\'s own counts: unavailable')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '5 things need you' })).toBeInTheDocument();
    expect(card('The scoreboard')).toBeTruthy();
    expect(document.querySelector('[data-foot]')!.textContent).toContain('Tool failures, every doorUnavailable');
  });

  const failures: [StatusRead, string][] = [[{ state: 'failed' }, "The platform's status did not load"], [{ state: 'slow' }, "The platform's status is unavailable"]];
  for (const [read, title] of failures) {
    it(`error: a ${read.state} read is the error state naming the platform's status, with Retry`, () => {
      const { container } = draw(read);
      expect(screen.getByRole('alert')).toHaveTextContent(title);
      expect(container.textContent).not.toMatch(/Malformed calls per 1,000|\d+\.\d(?! seconds)/);
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  }

  it('says the slow read was bounded, never an endless wait', () => {
    draw({ state: 'slow' });
    expect(screen.getByRole('alert')).toHaveTextContent('It did not answer within 4.5 seconds');
  });

  it('dates the masthead with the read\'s own cutoff, and nothing when there is no read', () => {
    const { unmount } = render(<PlatformStatusAsOf read={ok(PLATFORM_STATUS)} />);
    expect(screen.getByText(`As of ${formatDateTime(PLATFORM_STATUS.meta.asOf)}`)).toBeInTheDocument();
    unmount();
    const { container } = render(<PlatformStatusAsOf read={{ state: 'failed' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('what the assistant is told', () => {
  const text = (s: PlatformStatus) => contextText(platformStatusContext(ok(s)));

  it('carries the values the page draws, inside the budget', () => {
    const t = text(PLATFORM_STATUS);
    const last = MALFORMED.last!;
    expect(t).toContain(`last whole week: the week of ${formatDay(last.window.from)}`);
    for (const r of PLATFORM_STATUS.needs.rows) expect(t).toContain(r.title);
    expect(t).toContain(`- Malformed calls per 1,000: ${(1000 * last.numerator! / last.denominator!).toFixed(1)}, ${last.numerator} of ${last.denominator} calls; up `);
    expect(t).toContain('- What needs attention: 5 things need you.\n');
    expect(text({ ...PLATFORM_STATUS, needs: { ...PLATFORM_STATUS.needs, total: 6, knownCount: 6, overflowByKind: { approvals: 1 }, headline: '6 things need you' } }))
      .toContain('- What needs attention: 6 things need you, 1 more not shown: approvals 1.');
    expect(t).toContain('of 5 measures are better than the week before');
    for (const d of DOORS) expect(t).toContain(d.finding.text);
    expect(t).toContain('0.97.0');
    expect(t).toMatch(/- Your team: malformed per 1,000 .+, bug reports \d+ filed/);
    expect(t).toContain(`As of ${formatDateTime(PLATFORM_STATUS.meta.asOf)}`);
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('says what the values cannot say', () => {
    const t = text(PLATFORM_STATUS);
    expect(t).toContain('nothing here says whether a door could be reached');
    expect(t).toContain('never better or worse');
    expect(text({ ...PLATFORM_STATUS, running: { state: 'unavailable', reason: 'unrecorded' } })).toContain('unrecorded');
    expect(text({ ...PLATFORM_STATUS, doors: { state: 'unavailable', reason: 'timeout' } })).toContain('The doors could not be read (timeout).');
  });

  it('says a member\'s headline to a member, and that nothing was read when nothing was', () => {
    expect(text(MEMBER_STATUS)).toContain('5 things are known and open');
    expect(text(MEMBER_STATUS).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    const failed = contextText(platformStatusContext({ state: 'slow' }));
    expect(failed).toContain("The platform's status is unavailable");
    expect(failed).not.toContain('Facts:');
  });
});

describe('view_platform_status and its prepared query', () => {
  it('answers the same response its page reads, reduced the same way', async () => {
    gateway.get.mockResolvedValueOnce(PLATFORM_STATUS);
    const { context, data } = await platformStatusTool.read({});
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/status');
    expect(data).toBe(PLATFORM_STATUS);
    expect(context).toEqual(platformStatusContext(statusRead(PLATFORM_STATUS)));
  });

  it('declares its measures over /platform/query: the calls, the refusals and the malformed calls, the rate per 1,000 their ratio', () => {
    expect(platformStatusTool.name).toBe('platform_status');
    expect(platformStatusTool.page).toBe('/platform');
    const { sources } = platformStatusTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ malformed: 'malformed', calls: 'platform_calls', refusals: 'platform_refusals' });
    expect(sources.malformed.measures.per1000).toMatchObject({ derive: 'ratio', of: ['malformed', 'calls.calls'] });
  });
});

describe('the read on the server', () => {
  it('asks the gateway for the status and hands the whole of it on', async () => {
    gateway.get.mockResolvedValueOnce(PLATFORM_STATUS);
    expect(await readStatus()).toEqual({ state: 'ok', status: PLATFORM_STATUS });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/status');
  });

  it('is failed when the gateway refuses, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new Error("could not read the platform's status"));
    expect(await readStatus()).toEqual({ state: 'failed' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValueOnce(new Promise(() => {}));
    const read = readStatus();
    await act(async () => { await vi.advanceTimersByTimeAsync(READ_BOUND_MS - 1); });
    let settled: StatusRead | null = null;
    void read.then((r) => { settled = r; });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(settled).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(await read).toEqual({ state: 'slow' });
  });
});

function Wrap({ children }: { children: ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>;
}
