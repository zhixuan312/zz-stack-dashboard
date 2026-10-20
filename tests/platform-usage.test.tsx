import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/platform/usage',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh: router.refresh, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', () => ({ gatewayGet: gateway.get }));
vi.mock('@/data/access', async (load) => ({ ...(await load<typeof import('@/data/access')>()), requireNeed: async () => {} }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (load) => ({ ...(await load<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { FLEET_FIELDS } from '@/data/prepared';
import { MAIN_ROLES, effective } from '@/data/roles';
import { exploreSchema, type ExploreRights } from '@/lib/explore';
import type { Usage } from '@/lib/fleet-shapes';
import type { Part } from '@/lib/platform-shapes';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET, READ_BOUND_MS } from '@/views/context';
import { PlatformUsageView, UsageAsOf } from '@/views/pages/platform-usage';
import { usageContext, type UsageRead } from '@/views/platform-usage-context';
import { usageTool } from '@/views/tools/usage';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';
import { readUsage } from '../app/(dash)/platform/usage/read-usage';
import UsageLoading from '../app/(dash)/platform/usage/loading';

/**
 * Usage under Platform (Task I-101): the page drawn from the fake gateway's own answer as the superadmin and as a member,
 * read first on the console's server; the four tiles, the calls by week split by team for the superadmin alone, the two
 * compositions, the refusals put right, each tool's median, the weekday by hour, the tools called most, calls per
 * approval and the model calls; every state; the Ask on the protagonist; and `view_usage` with `explore_usage`.
 */
const ADMIN = usage(true);
const MEMBER = usage(false);
const ok = (u: Usage): UsageRead => ({ state: 'ok', usage: u });
/** A part the fixture answers, which is every one of them. */
function data<T>(p: Part<T>): T {
  if (p.state !== 'ok') throw new Error(p.reason);
  return p.data;
}
const WEEKS = data(ADMIN.callsByWeek).weeks;
const TEAMS = WEEKS.find((w) => w.parts)!.parts!.map((p) => p.label).filter((l) => l !== 'Other');

/** The view as the shell holds it: inside the tooltip provider, on the console's surface, with an assistant when `ask` is given. */
const draw = (read: UsageRead, ask?: (q: string) => void) =>
  render(<SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider><PlatformUsageView read={read} /></Tooltip.Provider></SurfaceOverride>);
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section, .card') as HTMLElement;

beforeEach(() => { router.refresh.mockReset(); gateway.get.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('who opens Usage', () => {
  it('needs platform:read, which both roles hold', () => {
    expect(FEATURES.usage).toEqual({ title: 'Usage', needs: 'platform:read' });
    for (const role of MAIN_ROLES) expect(effective(role).has('platform:read'), role).toBe(true);
  });
});

describe('the page, as the fake gateway answers it', () => {
  it('draws the four tiles of the last whole week, with no zero where a figure is missing', () => {
    const { container } = draw(ok(ADMIN));
    for (const label of ['Calls', 'Share refused', 'Slowest 5% of calls', 'Sessions']) expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    const values = [...container.querySelectorAll('[data-figures="read"] [data-value]')].map((v) => v.textContent);
    expect(values[0]).toBe('125');
    expect(values[1]).toBe('46.4%');
    expect(values).toHaveLength(4);
  });

  it('splits the calls by week into parts by team for the superadmin', () => {
    draw(ok(ADMIN));
    const calls = card('Calls by week');
    const legend = calls.querySelector('[data-legend]')!;
    for (const t of [...TEAMS, 'Other']) expect(legend.textContent).toContain(t);
    expect(calls.querySelectorAll('[data-column]')).toHaveLength(WEEKS.length);
  });

  it('draws a member\'s calls by week with no parts, and names no team anywhere', () => {
    const { container } = draw(ok(MEMBER));
    const calls = card('Calls by week');
    expect(calls.querySelector('[data-legend]')).toBeNull();
    expect(calls.querySelectorAll('[data-part]')).toHaveLength(0);
    expect(calls.querySelectorAll('[data-column]')).toHaveLength(WEEKS.length);
    for (const t of TEAMS) expect(container.textContent).not.toContain(t);
  });

  it('draws the platform\'s own traffic and all refusals by population, each a Composition bar', () => {
    draw(ok(ADMIN));
    const traffic = card('The platform\'s own traffic');
    expect(within(traffic).getByTitle('Real work: 125')).toBeInTheDocument();
    expect(within(traffic).getByTitle('Maintenance: 54')).toBeInTheDocument();
    const refusals = card('All refusals by population');
    for (const t of ['Tool failures: 9', 'Malformed calls: 6', 'A guardrail held: 41', 'Other: 2', 'Maintenance: 10']) expect(within(refusals).getByTitle(t)).toBeInTheDocument();
  });

  it('draws the refusals put right by week, with median seconds, sessions continued and those that could not be judged', () => {
    draw(ok(ADMIN));
    const followup = card('Refusals put right');
    expect(followup.querySelectorAll('[data-column]')).toHaveLength(data(ADMIN.followup).weeks.length);
    const line = followup.querySelector('[data-followup]')!.textContent!;
    expect(line).toContain('Median seconds27 s');
    expect(line).toContain('Sessions continued87.5% of 16 refused sessions · too few to judge');
    expect(line).toMatch(/Could not be judged\d+ refusals?/);
  });

  it('draws each tool\'s median, first week against last, a too-small last week not comparable', () => {
    draw(ok(ADMIN));
    const table = screen.getByRole('table', { name: 'Each tool\'s median call, first week against last' });
    const row = (tool: string) => within(table).getAllByRole('row').find((r) => within(r).queryAllByText(tool).length > 0)!;
    expect(row('core:document_read').textContent).toContain('610 ms');
    expect(row('core:document_read').textContent).toContain('540 ms');
    expect(row('core:skill_read').textContent).toContain('140 ms, too few');
    expect(row('core:skill_read').textContent).toContain('Not comparable');
  });

  it('draws the weekday by hour in the read\'s own time zone', () => {
    draw(ok(ADMIN));
    const rhythm = card('Weekday by hour');
    expect(rhythm.textContent).toContain(`in ${data(ADMIN.rhythm).timezone}`);
    expect(within(rhythm).getByText(`Day (${data(ADMIN.rhythm).timezone})`)).toBeInTheDocument();
  });

  it('draws the tools called most, a tool no door registers under one name', () => {
    draw(ok(ADMIN));
    const most = card('Tools called most');
    expect(within(most).getByTitle('core:document_read')).toBeInTheDocument();
    expect(within(most).getByTitle('Unregistered tools')).toBeInTheDocument();
  });

  it('draws calls per recorded approval, and the model calls with their cost not recorded', () => {
    draw(ok(ADMIN));
    const per = card('Calls per recorded approval');
    expect(per.textContent).toContain('25.0 (125 calls, 5 approvals)');
    expect(per.textContent).toContain('25.0 (200 calls, 8 approvals)');
    const model = card('The platform\'s model calls');
    expect(model.textContent).toContain('412, 3 failed');
    expect(model.textContent).toContain('1,204,330 in, 88,120 out');
    expect(model.textContent).toContain('typed-judge 405, failure-discover 7');
    expect(model.querySelector('[data-cost]')!.textContent).toBe('Not recorded');
  });

  it('calls no movement good or bad, on the page or to the assistant', () => {
    for (const u of [ADMIN, MEMBER]) {
      const { container, unmount } = draw(ok(u));
      const said = container.textContent!.replace('not better or worse', '');
      expect(said).not.toMatch(/\b(better|worse|improv\w*|good|bad|healthy|worsen\w*)\b/i);
      unmount();
    }
    expect(contextText(usageContext(ok(ADMIN))).replace('are not better or worse', '')).not.toMatch(/\b(better|worse|improv\w*|good|bad|healthy)\b/i);
  });
});

describe('the page\'s states', () => {
  it('loading: the page\'s shape, announced as busy, naming no page under the absent refusal', () => {
    render(<Tooltip.Provider><UsageLoading /></Tooltip.Provider>);
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveAttribute('aria-busy', 'true');
  });

  it('partial: a part that is unavailable draws its own state and the rest stands', () => {
    draw(ok({ ...ADMIN, refusals: { state: 'unavailable', reason: 'the refusals did not answer' }, tools: { state: 'unavailable', reason: 'no medians' } }));
    expect(screen.getByText('All refusals by population: unavailable')).toBeInTheDocument();
    expect(screen.getByText('Each tool\'s median call: unavailable')).toBeInTheDocument();
    expect(screen.getByText(/the refusals did not answer/)).toBeInTheDocument();
    expect(card('The platform\'s own traffic')).toBeTruthy();
    expect(card('Calls by week')).toBeTruthy();
  });

  it('keeps the Ask on the calls by week when they are unavailable', () => {
    draw(ok({ ...ADMIN, callsByWeek: { state: 'unavailable', reason: 'timeout' } }), vi.fn());
    expect(screen.getByText('Calls by week: unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ask: / }).closest('[data-protagonist="Calls by week"]')).not.toBeNull();
  });

  it('draws a missing week as missing, never as zero', () => {
    const at = 2;
    const gap = (u: Usage): Usage => ({
      ...u,
      callsByWeek: { state: 'ok', data: { weeks: data(u.callsByWeek).weeks.map((w, i) => (i === at ? { ...w, calls: { value: null, why: 'unavailable' }, parts: w.parts && null } : w)) } },
    });
    for (const u of [ADMIN, MEMBER]) {
      const { unmount } = draw(ok(gap(u)));
      const columns = card('Calls by week').querySelectorAll('[data-column]');
      expect(columns[at].hasAttribute('data-no-data'), 'the gap').toBe(true);
      expect(columns[1].hasAttribute('data-no-data'), 'a week with no calls is zero, not missing').toBe(false);
      unmount();
    }
    const t = contextText(usageContext(ok(gap(MEMBER))));
    expect(t).toContain(`${formatDay(WEEKS[at].window.from)} Unavailable`);
  });

  it('says a tile with no figure in words, never a zero', () => {
    const tiles = data(ADMIN.tiles);
    const none = { ...tiles.sessions, last: { ...tiles.sessions.last, figure: { value: null, why: 'no_data' as const } } };
    const { container } = draw(ok({ ...ADMIN, tiles: { state: 'ok', data: { ...tiles, sessions: none } } }));
    expect([...container.querySelectorAll('[data-figures="read"] [data-value]')][3].textContent).toBe('No data');
  });

  const failures: [UsageRead, string, string][] = [
    [{ state: 'failed', reason: 'The gateway refused the read' }, 'Usage did not load', 'The gateway refused the read. Nothing on this page was read.'],
    [{ state: 'slow' }, 'Usage is unavailable', `The read did not answer within ${READ_BOUND_MS / 1000} seconds.`],
  ];
  for (const [read, title, detail] of failures) {
    it(`error: a ${read.state} read is the error state, with Retry asking the server again`, () => {
      const { container } = draw(read);
      expect(screen.getByRole('alert')).toHaveTextContent(title);
      expect(screen.getByRole('alert')).toHaveTextContent(detail);
      expect(container.querySelector('[data-figures]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  }

  it('dates the masthead with the read\'s own cutoff, and nothing when there is no read', () => {
    const { unmount } = render(<UsageAsOf read={ok(ADMIN)} />);
    expect(screen.getByText(`As of ${formatDateTime(ADMIN.meta.asOf)}`)).toBeInTheDocument();
    unmount();
    const { container } = render(<UsageAsOf read={{ state: 'slow' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('the Ask on the calls by week', () => {
  it('sits in the head of the calls by week with the assistant on, and is absent with it off', () => {
    const ask = vi.fn();
    const { unmount } = draw(ok(ADMIN), ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    const head = button.closest('[data-protagonist="Calls by week"]')!.querySelector('section, .card')!;
    expect(head.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith('How did real work\'s calls move week by week, and which teams made them?');
    unmount();
    const member = draw(ok(MEMBER), ask);
    expect(screen.getByRole('button', { name: /^Ask: / }).getAttribute('aria-label')).toBe('Ask: How did real work\'s calls move week by week?');
    member.unmount();
    draw(ok(ADMIN));
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('what the assistant is told', () => {
  const text = (u: Usage) => contextText(usageContext(ok(u)));

  it('carries the values the page draws, inside the budget', () => {
    const t = text(ADMIN);
    expect(t).toContain('- Calls: 125');
    expect(t).toContain('- Share refused: 46.4%');
    expect(t).toContain('125 real work, 54 maintenance');
    expect(t).toContain('9 tool failures, 6 malformed calls, 41 a guardrail held, 2 other, 10 maintenance');
    expect(t).toContain('cost not recorded');
    for (const team of TEAMS) expect(t).toContain(team);
    expect(t).toContain(`Weekday and hour are in ${ADMIN.meta.timezone}.`);
    expect(t).toContain(`As of ${formatDateTime(ADMIN.meta.asOf)}`);
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('names no team to a member, and says the read carries no split by team', () => {
    const t = text(MEMBER);
    for (const team of TEAMS) expect(t).not.toContain(team);
    expect(t).toContain('No team is named here: these weeks carry no split by team.');
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('says which parts could not be read, and that nothing was read when nothing was', () => {
    expect(text({ ...ADMIN, modelCalls: { state: 'unavailable', reason: 'timeout' } })).toContain('The platform\'s model calls could not be read (timeout).');
    const slow = contextText(usageContext({ state: 'slow' }));
    expect(slow).toContain('Usage is unavailable');
    expect(slow).not.toContain('Facts:');
  });
});

describe('view_usage and explore_usage', () => {
  it('answers the same response its page reads, with the page\'s context', async () => {
    gateway.get.mockResolvedValueOnce(ADMIN);
    const { context, data: answered } = await usageTool.read({});
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/usage');
    expect(answered).toBe(ADMIN);
    expect(context).toEqual(usageContext(ok(ADMIN)));
    expect(usageTool.name).toBe('usage');
    expect(usageTool.page).toBe('/platform/usage');
    expect(usageTool.needs).toBe(FEATURES.usage.needs);
  });

  it('declares the platform\'s calls, its refusals and its model calls, with team offered to the superadmin alone', () => {
    const { sources } = usageTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ calls: 'platform_calls', refusals: 'platform_refusals', modelCalls: 'model_calls' });
    const readable = new Set(Object.values(sources).map((s) => s.collection));
    const rights = (wide: boolean): ExploreRights => ({ readable, hidden: (name) => (wide ? [] : FLEET_FIELDS[name] ?? []) });
    const offered = (wide: boolean) => JSON.stringify(z.toJSONSchema(exploreSchema(usageTool.explore, rights(wide))));
    expect(offered(true)).toContain('"team"');
    expect(offered(false)).not.toContain('"team"');
    expect(offered(false)).toContain('"model"');
  });
});

describe('the read on the server', () => {
  it('asks the gateway for the usage and hands the whole of it on', async () => {
    gateway.get.mockResolvedValueOnce(ADMIN);
    expect(await readUsage()).toEqual({ state: 'ok', usage: ADMIN });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/usage');
  });

  it('is failed with the gateway\'s sentence when it refuses, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new Error('could not read the usage'));
    expect(await readUsage()).toEqual({ state: 'failed', reason: 'could not read the usage' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValueOnce(new Promise(() => {}));
    const read = readUsage();
    let settled: UsageRead | null = null;
    void read.then((r) => { settled = r; });
    await act(async () => { await vi.advanceTimersByTimeAsync(READ_BOUND_MS - 1); });
    expect(settled).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(await read).toEqual({ state: 'slow' });
  });
});
