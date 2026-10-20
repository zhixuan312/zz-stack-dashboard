import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The router as the address writer sees it: a replace lands in the address, as a navigation does. */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace(url: string) { window.history.replaceState(null, '', url); } }),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { GatewayError } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import type { Me } from '@/lib/api-shapes';
import type { Audit, AuditRow } from '@/lib/fleet-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET, READ_BOUND_MS } from '@/views/context';
import { PlatformAuditView } from '@/views/pages/platform-audit';
import {
  AUDIT_DEFAULTS, NOBODY, actSentence, auditContext, auditPath, beforeDays, dayStart, dayWords, feedEvent, filtersOfPath, type AuditFilters, type AuditRead, type ReportTitles,
} from '@/views/platform-audit-context';
import { auditTool } from '@/views/tools/audit';
import { audit } from '../scripts/fake-gateway/platform-audit.ts';
import PlatformAuditLoading from '../app/(dash)/platform/audit/loading';
import PlatformAuditPage, { generateMetadata as auditMetadata } from '../app/(dash)/platform/audit/page';
import { readAudit } from '../app/(dash)/platform/audit/read-audit';

/**
 * Audit under Platform (Task I-102), the superadmin's: two tabs drawn from the fake gateway's own answers, each read
 * first on the console's server. Administration is ZZ Meridian's Activity feed, one sentence an act as the gateway said
 * it, an unrecorded actor `Someone not recorded`, the platform's mark on maintenance alone and the agent's never, with the
 * acts Audit cannot show named under it; Everything is the event table, the latest 500 within its filters, which reach
 * older events. Every state draws; a member is answered by the refused page; the Ask sits on each tab's card; and
 * `view_audit` and `explore_audit` answer as the page does.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};
const MEMBER: Me = {
  email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false,
  via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon',
};

/** The fake's answer to `q`, the gateway's own projection of its events. */
const answer = (q: Record<string, string>, limit = 10, offset = 0): Audit => audit(new URLSearchParams(q), { limit, offset })![1] as Audit;
const ALL_TAB: AuditFilters = { ...AUDIT_DEFAULTS, filter: 'all' };
const ADMIN = answer({});
const ALL = answer({ filter: 'all' });
const ok = (data: Audit = ADMIN, path = auditPath(AUDIT_DEFAULTS), reports: ReportTitles = {}): AuditRead => ({ state: 'ok', path, data, reports });

/** The browser's reads: answered by `answer`, or never when it is null. */
function browser(reply: ((path: string) => [number, unknown]) | null) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (!reply) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, SUPERADMIN] : reply(`${url.pathname.replace('/api/console', '')}${url.search}`);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
/** What the browser has read, past who it is. */
const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'));

const tree = (ui: ReactElement, ask?: (q: string) => void) => <SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>;
/** `ui` in the console's providers, with an assistant listening when `ask` is given; `serve` rerenders it as the server would. */
function mount(ui: ReactElement, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}>{tree(ui, ask)}</QueryClientProvider>);
  return { ...rendered, serve: (next: ReactElement) => rendered.rerender(<QueryClientProvider client={client}>{tree(next, ask)}</QueryClientProvider>) };
}
const feed = () => document.querySelector<HTMLElement>('[data-protagonist="Administration"]')!;
/** The feed's own lines: its list is the card's first, before the pager's. */
const lines = () => [...feed().querySelector('ol')!.children];
const events = () => screen.getByRole('table', { name: 'Events, newest first' });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });
/** Choose `option` in the Select named `name`. */
async function choose(name: string, option: string | RegExp) {
  fireEvent.keyDown(screen.getByRole('combobox', { name }), { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: option }), { key: 'Enter' });
}
/** Press a tab as a pointer does: Radix activates a tab on the press, not the click. */
const press = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false });

beforeEach(() => {
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/platform/audit');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Audit draws two tabs', () => {
  it('Administration and Everything, Administration the plain address', () => {
    browser(null);
    mount(<PlatformAuditView served={ok()} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Administration', 'Everything']);
    expect(screen.getByRole('tab', { name: 'Administration' })).toHaveAttribute('aria-selected', 'true');
    expect(feed()).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('moves to Everything on the server\'s read of its address, never a browser read beside it, its filters cleared', async () => {
    window.history.replaceState(null, '', '/platform/audit?page=2');
    browser(() => [200, ALL]);
    const { serve } = mount(<PlatformAuditView served={ok(answer({}, 10, 10), auditPath({ ...AUDIT_DEFAULTS, page: '2' }))} />);
    await settle();
    press('Everything');
    await settle();
    expect(window.location.search).toBe('?filter=all');
    expect(reads()).toEqual([]);
    serve(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />);
    await waitFor(() => expect(within(events()).getAllByRole('row')).toHaveLength(ALL.rows.length + 1));
    expect(reads()).toEqual([]);
  });
});

describe('Administration, the Activity feed', () => {
  it('one line an act, each the gateway\'s sentence, newest first, a report it names left by its id when no title was read', () => {
    browser(null);
    mount(<PlatformAuditView served={ok()} />);
    expect(lines()).toHaveLength(ADMIN.rows.length);
    ADMIN.rows.forEach((r, i) => expect(lines()[i].querySelector('p')!.textContent!.trim()).toBe(actSentence(r)));
    ADMIN.rows.filter((r) => !r.kind.startsWith('bug.')).forEach((r) => expect(actSentence(r)).toBe(r.sentence));
    expect(feed().textContent).toContain('added maximiliana.fitzgerald-oyelaran@example.com to atlas as member in the console');
  });

  it('an act nobody was recorded for names Someone not recorded', () => {
    browser(null);
    mount(<PlatformAuditView served={ok()} />);
    const nobody = ADMIN.rows.find((r) => r.actor === null)!;
    const line = lines()[ADMIN.rows.indexOf(nobody)];
    expect(line.querySelector('p span')!.textContent).toBe(NOBODY);
    expect(line.textContent).toContain(`${NOBODY} issued a token for`);
    expect(feedEvent(nobody).actor).toBe(NOBODY);
    // Its mark is the feed's unknown actor, a dashed empty disc with no initials, never a person's (ZZ Meridian #68).
    expect(feedEvent(nobody).unknown).toBe(true);
    expect(line.querySelector('[data-actor-unknown]')).not.toBeNull();
    expect(ADMIN.rows.filter((r) => r.actor !== null).every((r) => feedEvent(r).unknown === undefined)).toBe(true);
  });

  it('marks an act as the platform\'s own only when its origin is platform, and never as an agent\'s', () => {
    window.history.replaceState(null, '', '/platform/audit?page=2');
    browser(null);
    const second = answer({}, 10, 10);
    mount(<PlatformAuditView served={ok(second, auditPath({ ...AUDIT_DEFAULTS, page: '2' }))} />);
    second.rows.forEach((r, i) => {
      const dot = lines()[i].querySelector('.bg-fill-track');
      expect(dot !== null, r.id).toBe(r.origin === 'platform');
    });
    expect(second.rows.some((r) => r.origin === 'platform')).toBe(true);
    expect(feed().querySelector('svg.lucide-sparkles')).toBeNull();
    for (const r of [...ADMIN.rows, ...second.rows]) {
      expect(feedEvent(r).via).toBeUndefined();
      expect(feedEvent(r).system === true).toBe(r.origin === 'platform');
    }
  });

  it('links an act about a team or a report to its page, the link beginning with its name and the sentence unchanged', () => {
    const at = (kind: string, subject: string, sentence: string) => ({ ...ADMIN.rows[0], actor: 'Ava', kind, subject, sentence });
    const made = feedEvent(at('admin.create_team', 'beacon', 'Ava created team beacon'));
    expect(made).toMatchObject({ verb: 'created team', object: 'beacon', href: '/platform/teams/beacon' });
    const added = feedEvent(at('admin.add_member', 'atlas:ivy@example.com', 'Ava added ivy@example.com to atlas as member in the console'));
    expect(added).toMatchObject({ verb: 'added ivy@example.com to', object: 'atlas as member in the console', href: '/platform/teams/atlas' });
    const resolved = feedEvent(at('bug.console_resolve', '41', 'Ava resolved report 41 as fixed in the console'), { 41: 'Search is slow' });
    expect(resolved).toMatchObject({ verb: 'resolved report', object: '"Search is slow" as fixed in the console', href: '/platform/bugs/41' });
    for (const e of [made, added, resolved]) expect(`${e.verb} ${e.object}`).toBe(e === made ? 'created team beacon' : e === added ? 'added ivy@example.com to atlas as member in the console' : 'resolved report "Search is slow" as fixed in the console');
    // A deleted report has no page, and an act about a person or a token has none here.
    expect(feedEvent(at('bug.delete', '41', 'Ava deleted report 41')).href).toBeUndefined();
    expect(feedEvent(at('admin.issue_pat', 'ivy@example.com', 'Ava issued a token for ivy@example.com')).href).toBeUndefined();
  });

  it('names a channel only where the gateway says it was the console, and never infers one', () => {
    browser(null);
    const every = answer({}, 100);
    mount(<PlatformAuditView served={ok(every)} />);
    // Each line is the gateway's sentence, and zz-core's `bug_resolve` named on the act it recorded; around them the
    // card adds no channel of its own.
    every.rows.forEach((r, i) => expect(lines()[i].querySelector('p')!.textContent!.trim()).toBe(actSentence(r)));
    const around = feed().cloneNode(true) as HTMLElement;
    around.querySelector('ol')!.remove();
    expect(around.textContent).not.toMatch(/\b(MCP|OAuth|script|door|console)\b/i);
    for (const r of every.rows) expect(r.sentence!.endsWith(' in the console')).toBe(r.inConsole);
  });

  it('names under the feed the acts Audit cannot show', () => {
    browser(null);
    mount(<PlatformAuditView served={ok()} />);
    const named = feed().querySelector('[data-not-recorded]')!;
    for (const act of ADMIN.notRecorded) expect(named.textContent).toContain(act);
    expect(named.textContent).toMatch(/cannot show/);
  });

  it('pages at ten on the server\'s read of the new address', async () => {
    browser(() => [200, ADMIN]);
    const { serve } = mount(<PlatformAuditView served={ok()} />);
    expect(ADMIN.total).toBeGreaterThan(10);
    fireEvent.click(within(feed()).getByRole('button', { name: 'Next page' }));
    await settle();
    expect(window.location.search).toBe('?page=2');
    expect(reads()).toEqual([]);
    const second = answer({}, 10, 10);
    serve(<PlatformAuditView served={ok(second, auditPath({ ...AUDIT_DEFAULTS, page: '2' }))} />);
    await waitFor(() => expect(lines()).toHaveLength(second.rows.length));
  });
});

describe('Everything, the event table', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/platform/audit?filter=all'); });

  it('lists every event but page views as metadata, newest first, with its count', () => {
    browser(null);
    mount(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />);
    expect(within(events()).getAllByRole('row')).toHaveLength(ALL.rows.length + 1);
    expect(events().textContent).not.toContain('console.page_view');
    expect(events().textContent).toContain('tool_call');
    expect(screen.getByText(`${ALL.total} events`)).toBeInTheDocument();
    // Metadata only: nothing the fake plants in an event's detail reaches the table.
    for (const planted of ['beacon-salaries-2026.csv', 'Salary bands', 'release scripts on the build box', 'salary review list', 'Chargeback ledger v2']) {
      expect(document.body.textContent).not.toContain(planted);
    }
  });

  it('says an unrecorded actor and an unrecorded channel as unrecorded, never a door', () => {
    browser(null);
    mount(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />);
    const nobody = within(events()).getAllByRole('row').find((tr) => tr.textContent!.includes('admin.issue_pat'))!;
    expect(nobody.textContent).toContain('Not recorded');
    expect(events().textContent).not.toMatch(/\bMCP\b/);
    const refused = within(events()).getAllByRole('row').find((tr) => tr.textContent!.includes('core:document_read'))!;
    expect(refused.textContent).toContain('A guardrail held');
  });

  it('says the latest 500 at the ceiling', () => {
    browser(null);
    const full: Audit = { ...ALL, total: 500 };
    mount(<PlatformAuditView served={ok(full, auditPath(ALL_TAB))} />);
    expect(screen.getByText('500 events, the latest 500')).toBeInTheDocument();
    expect(contextText(auditContext(full, { filters: ALL_TAB }))).toContain('The read stops at the latest 500');
  });

  it('has its three filters, and a day sent as the instant it began in the reporting time zone', async () => {
    browser(() => [200, ALL]);
    const { serve } = mount(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />);
    for (const name of ['Kind', 'Team', 'Before']) expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
    const [first] = beforeDays(ALL.meta, 'all');
    expect(first).toMatch(/^\d{4}-\d{2}-01$/);
    await choose('Before', dayWords(first));
    await settle();
    expect(window.location.search).toBe(`?filter=all&before=${first}`);
    expect(reads()).toEqual([]);
    const filters: AuditFilters = { ...ALL_TAB, before: first };
    expect(auditPath(filters)).toBe(`/platform/audit?filter=all&before=${encodeURIComponent(dayStart(first))}&limit=10&offset=0`);
    const older = answer({ filter: 'all', before: dayStart(first) });
    serve(<PlatformAuditView served={ok(older, auditPath(filters))} />);
    await waitFor(() => expect(within(events()).getAllByRole('row')).toHaveLength(older.rows.length + 1));
    for (const r of older.rows) expect(Date.parse(r.at)).toBeLessThan(Date.parse(dayStart(first)));
    expect(reads()).toEqual([]);
  });

  it('a kind or a team narrows it before the ceiling, the figures the gateway\'s', async () => {
    browser(() => [200, ALL]);
    const { serve } = mount(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />);
    await choose('Team', 'beacon');
    await settle();
    expect(window.location.search).toBe('?filter=all&team=beacon');
    const filters: AuditFilters = { ...ALL_TAB, team: 'beacon' };
    expect(auditPath(filters)).toBe('/platform/audit?filter=all&team=beacon&limit=10&offset=0');
    const beacon = answer({ filter: 'all', team: 'beacon' });
    serve(<PlatformAuditView served={ok(beacon, auditPath(filters))} />);
    await waitFor(() => expect(within(events()).getAllByRole('row')).toHaveLength(beacon.rows.length + 1));
    expect(screen.getByText(`${beacon.total} events`)).toBeInTheDocument();
    expect(reads()).toEqual([]);
  });

  it('a filter that keeps nothing is the filtered empty state with Clear filters', () => {
    window.history.replaceState(null, '', '/platform/audit?filter=all&kind=admin.remove_member');
    browser(null);
    const filters: AuditFilters = { ...ALL_TAB, kind: 'admin.remove_member' };
    mount(<PlatformAuditView served={ok(answer({ filter: 'all', kind: 'admin.remove_member' }), auditPath(filters))} />);
    expect(screen.getByText('No events match these filters')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Clear/ }).length).toBeGreaterThan(0);
  });
});

describe('the first paint of a filtered address', () => {
  /** `ui` as the console's server renders it, where the address is not known to the browser's query state yet. */
  const served = (ui: ReactElement) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return { client, html: renderToString(<QueryClientProvider client={client}>{tree(ui)}</QueryClientProvider>) };
  };

  it('draws the tab and the rows of the address the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/platform/audit?filter=all&team=beacon');
    browser(null);
    const filters: AuditFilters = { ...ALL_TAB, team: 'beacon' };
    const beacon = answer({ filter: 'all', team: 'beacon' });
    const view = <PlatformAuditView served={ok(beacon, auditPath(filters))} />;
    const { client, html } = served(view);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const selected = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(selected?.textContent).toBe('Everything');
    expect(container.querySelector('[data-protagonist="Administration"]')).toBeNull();
    const table = container.querySelector('table[aria-label="Events, newest first"], section[aria-label="Events, newest first"] table')!;
    expect(table).not.toBeNull();
    expect(table.getAttribute('aria-busy')).not.toBe('true');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(beacon.rows.length);
    // The browser takes the server's markup over as it stands: no mismatch, and the rows stay drawn.
    const mismatches: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, <QueryClientProvider client={client}>{tree(view)}</QueryClientProvider>, { onRecoverableError: (e) => mismatches.push(e) });
    });
    expect(mismatches).toEqual([]);
    expect(within(container).getByRole('tab', { name: 'Everything' })).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(beacon.rows.length);
    await waitFor(() => expect(within(container).getByRole('combobox', { name: 'Team' }).textContent).toContain('beacon'));
    expect(reads()).toEqual([]);
    container.remove();
  });

  it('draws a later page of Administration as the page the server read', () => {
    window.history.replaceState(null, '', '/platform/audit?page=2');
    browser(null);
    const second = answer({}, 10, 10);
    const { html } = served(<PlatformAuditView served={ok(second, auditPath({ ...AUDIT_DEFAULTS, page: '2' }))} />);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Administration');
    expect(container.querySelector('[data-protagonist="Administration"] ol')!.children).toHaveLength(second.rows.length);
  });

  it('reads the address back from the server\'s path, a day from the instant it was sent as', () => {
    for (const f of [AUDIT_DEFAULTS, { ...AUDIT_DEFAULTS, page: '3' }, { ...ALL_TAB, kind: 'team.switch', team: 'beacon', before: '2026-10-01', page: '2' }]) {
      expect(filtersOfPath(auditPath(f))).toEqual(f);
    }
  });
});

describe('each state draws', () => {
  it('loading while the server\'s read of the address is on its way, never a browser read', async () => {
    window.history.replaceState(null, '', '/platform/audit?filter=all');
    browser(() => [200, ALL]);
    mount(<PlatformAuditView served={ok()} />);
    await settle();
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(reads()).toEqual([]);
  });

  it('nothing recorded on either tab', () => {
    browser(null);
    const none: Audit = { ...ADMIN, rows: [], total: 0 };
    const { unmount } = mount(<PlatformAuditView served={ok(none)} />);
    expect(screen.getByText('No act of administration recorded yet')).toBeInTheDocument();
    unmount();
    window.history.replaceState(null, '', '/platform/audit?filter=all');
    // A fresh deployment: nothing recorded, so the record begins on no day and no earlier day is offered.
    const fresh: Audit = { ...ALL, rows: [], total: 0, meta: { ...ALL.meta, coverageFrom: null } };
    mount(<PlatformAuditView served={ok(fresh, auditPath(ALL_TAB))} />);
    expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument();
    expect(beforeDays(fresh.meta, 'all')).toEqual([]);
    const text = contextText(auditContext(fresh, { filters: ALL_TAB }));
    expect(text).toContain('Record begins: Nothing recorded yet');
    expect(text).toContain('No event is recorded.');
  });

  it('a failed read is the error with the gateway\'s sentence and Retry, which reads again', async () => {
    browser(() => [200, ADMIN]);
    mount(<PlatformAuditView served={{ state: 'failed', path: auditPath(AUDIT_DEFAULTS), reason: 'could not read the events' }} />);
    expect(screen.getByText('could not read the events')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(lines()).toHaveLength(ADMIN.rows.length));
    expect(reads()).toEqual([expect.stringContaining('/api/console/platform/audit?filter=administration&limit=10&offset=0')]);
  });

  it('a read that did not answer in time is the error, never an endless skeleton', () => {
    browser(null);
    const { unmount } = mount(<PlatformAuditView served={{ state: 'slow', path: auditPath(AUDIT_DEFAULTS) }} />);
    expect(screen.getByText(`The read did not answer within ${READ_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    unmount();
    window.history.replaceState(null, '', '/platform/audit?filter=all');
    mount(<PlatformAuditView served={{ state: 'slow', path: auditPath(ALL_TAB) }} />);
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
    expect(screen.getByText(`The read did not answer within ${READ_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
  });
});

describe('the Ask on each tab\'s card', () => {
  it('sits in the head of the feed\'s card with the assistant on, and is absent with it off', () => {
    browser(null);
    const ask = vi.fn();
    const { unmount } = mount(<PlatformAuditView served={ok()} />, ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    const card = button.closest('[data-protagonist="Administration"]')!;
    expect(card.classList.contains('card')).toBe(true);
    expect(card.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(/^Ask: /, ''));
    unmount();
    mount(<PlatformAuditView served={ok()} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });

  it('sits in the event table\'s filter bar on Everything with the assistant on, and is absent with it off', () => {
    window.history.replaceState(null, '', '/platform/audit?filter=all');
    browser(null);
    const { unmount } = mount(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />, vi.fn());
    const button = screen.getByRole('button', { name: /^Ask: / });
    expect(button.closest('section')?.getAttribute('aria-label')).toBe('Events, newest first');
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    unmount();
    mount(<PlatformAuditView served={ok(ALL, auditPath(ALL_TAB))} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('view_audit and explore_audit', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      const q = new URLSearchParams(path.split('?')[1]);
      return answer(Object.fromEntries([...q].filter(([k]) => k !== 'limit' && k !== 'offset')), Number(q.get('limit')), Number(q.get('offset')));
    });
  });

  it('takes exactly the spec\'s arguments, filter, limit and offset', () => {
    expect(Object.keys(auditTool.input.shape).sort()).toEqual(['filter', 'limit', 'offset']);
    expect(auditTool.input.safeParse({}).success).toBe(false);
    expect(auditTool.input.safeParse({ filter: 'everything' }).success).toBe(false);
    expect(auditTool.page).toBe('/platform/audit');
    expect(auditTool.needs).toBe(FEATURES.audit.needs);
  });

  it('answers the same response the page reads, and the page\'s context', async () => {
    const { data, context } = await auditTool.read({ filter: 'administration' });
    expect(gateway.get).toHaveBeenCalledWith(auditPath(AUDIT_DEFAULTS));
    expect(data).toEqual(ADMIN);
    expect({ ...context, freshness: null }).toEqual({ ...auditContext(ADMIN, { filters: AUDIT_DEFAULTS }), freshness: null });
    const all = await auditTool.read({ filter: 'all', limit: 10, offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/audit?filter=all&limit=10&offset=10');
    expect(all.data).toEqual(answer({ filter: 'all' }, 10, 10));
    expect(all.context.address).toBe('/platform/audit?filter=all&page=2');
    const off = await auditTool.read({ filter: 'all', limit: 3, offset: 1 });
    expect(contextText(off.context)).toContain('does not show exactly these 3 rows');
  });

  it('explore_audit declares audit by kind and team, metadata only, the superadmin\'s', () => {
    const { sources } = auditTool.explore;
    expect(Object.values(sources).map((s) => s.collection)).toEqual(['audit']);
    const [events] = Object.values(sources);
    expect(Object.keys(events.filters).sort()).toEqual(['kind', 'team']);
    expect([...events.facets].sort()).toEqual(['kind', 'team']);
    const row = PREPARED.find((p) => p.name === 'audit')!;
    expect(row.route).toBe('platform');
    expect(row.needs).toBe(FEATURES.audit.needs);
    expect(row.dimensions).toEqual(['kind', 'team']);
    for (const c of events.drill.columns) expect(Object.keys(row.fields.shape)).toContain(c);
    expect(events.drill.columns).not.toContain('sentence');
    expect(events.drill.columns).toContain(row.key);
    expect(events.drill.address({ id: '1' })).toBe('/platform/audit');
    expect(events.cannot).toMatch(/metadata only/);
  });
});

describe('the shared context carries what the page draws, and what it cannot say', () => {
  it('Administration: the count, the acts as sentences, and what is not recorded', () => {
    const text = contextText(auditContext(ADMIN, { filters: AUDIT_DEFAULTS }));
    expect(text).toContain(`Acts of administration: ${ADMIN.total} acts`);
    expect(text).toContain(ADMIN.rows[0].sentence!);
    expect(text).toContain(NOBODY);
    expect(text).toContain('How an act arrived');
    for (const act of ADMIN.notRecorded) expect(text).toContain(act);
    expect(text).toContain(`${ADMIN.total - ADMIN.rows.length} more on later pages`);
  });

  it('Everything: the events as metadata, the filters named', () => {
    const filters: AuditFilters = { ...ALL_TAB, team: 'beacon' };
    const text = contextText(auditContext(answer({ filter: 'all', team: 'beacon' }), { filters }));
    expect(text).toContain('narrowed to team beacon');
    expect(text).toContain('core:document_read');
    expect(text).not.toContain('Chargeback ledger v2');
  });

  it('holds to the budget on a page of long sentences', () => {
    const long = `${'a person with a long address '.repeat(4)}added somebody with an even longer address to a team with a long slug as member in the console`;
    const rows: AuditRow[] = Array.from({ length: 10 }, (_, i) => ({ ...ADMIN.rows[0], id: String(i), sentence: long }));
    const text = contextText(auditContext({ ...ADMIN, rows, total: 500 }, { filters: { ...AUDIT_DEFAULTS, page: '7' } }));
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(text).toMatch(/and \d+ more \(see the page\)/);
  });
});

describe('the address', () => {
  it('a day of the reporting time zone begins at its own midnight, not UTC\'s', () => {
    expect(dayStart('2026-10-01', 'Asia/Singapore')).toBe('2026-09-30T16:00:00Z');
    expect(dayStart('2026-10-01', 'UTC')).toBe('2026-10-01T00:00:00Z');
    expect(dayStart('2026-03-08', 'America/New_York')).toBe('2026-03-08T05:00:00Z');
  });

  it('carries the filters on Everything alone, and drops what the route would refuse', () => {
    expect(auditPath({ ...AUDIT_DEFAULTS, kind: 'team.switch' })).toBe('/platform/audit?filter=administration&limit=10&offset=0');
    expect(auditPath({ ...ALL_TAB, kind: 'Team Switch', team: 'Beacon!', before: 'yesterday' })).toBe('/platform/audit?filter=all&limit=10&offset=0');
    expect(auditPath({ ...AUDIT_DEFAULTS, filter: 'everything', page: '3' })).toBe('/platform/audit?filter=administration&limit=10&offset=20');
  });
});

/** The text a server page's answer renders, once rendered with nothing listening. */
async function markupOf(page: ReactNode | Promise<ReactNode>): Promise<string> {
  const node = await page;
  let text = '';
  await act(async () => { text = mount(<>{node}</>).container.textContent ?? ''; });
  return text;
}

/** A report's title as `GET /platform/bugs/:id` answers it, for every report the fake's acts resolve: a deleted one is
 *  named by the gateway from its filing, and no read is made for it. */
const titleOf = (path: string) => ({ title: `The report ${path.split('/').at(-1)!.slice(-2)}` });
const TITLES: ReportTitles = Object.fromEntries(ADMIN.rows.filter((r) => r.kind === 'bug.resolve' || r.kind === 'bug.console_resolve').map((r) => [r.subject!, titleOf(r.subject!).title]));

describe('the page on the console\'s server', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => (path === '/me' ? SUPERADMIN : path.startsWith('/platform/bugs/') ? titleOf(path) : ADMIN));
  });

  it('is titled as its own page', async () => {
    expect(await auditMetadata()).toEqual({ title: 'Audit' });
  });

  it('reads the address once, as the person, and hands the one read to the as-of line and the page', async () => {
    const found: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const props = node.props as Record<string, unknown>;
      if (props.read) found.push(props.read);
      Object.values(props).forEach(walk);
    };
    walk(await PlatformAuditPage({ searchParams: Promise.resolve({}) }));
    expect(found).toHaveLength(2);
    expect(found[0]).toBe(found[1]);
    expect(await found[0]).toEqual(ok(ADMIN, auditPath(AUDIT_DEFAULTS), TITLES));
    expect(gateway.get.mock.calls.filter(([p]) => p === auditPath(AUDIT_DEFAULTS))).toHaveLength(1);
  });

  it('waits on a loading state that names nothing under refusal: \'absent\'', () => {
    const { container } = render(<PlatformAuditLoading />);
    expect(container.textContent).not.toMatch(/audit|administr|event/i);
  });
});

describe('a member asking for Audit', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return MEMBER;
      throw new GatewayError(403, 'not permitted');
    });
  });

  it('is titled as an address that names nothing', async () => {
    expect(await auditMetadata()).toEqual({ title: 'Not found', robots: { index: false } });
  });

  it('is answered by the refused page, which names nothing and reads nothing', async () => {
    browser(null);
    expect(await markupOf(PlatformAuditPage({ searchParams: Promise.resolve({ filter: 'all' }) }))).not.toMatch(/audit|administr|event/i);
    expect(gateway.get.mock.calls.map(([p]) => p)).not.toContainEqual(expect.stringMatching(/^\/platform\/audit/));
  });
});

describe('the read on the console\'s server', () => {
  it('reads the address\'s tab, filters and page, as the person', async () => {
    gateway.get.mockResolvedValueOnce(ALL);
    expect(await readAudit(ALL_TAB)).toEqual(ok(ALL, auditPath(ALL_TAB)));
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/audit?filter=all&limit=10&offset=0');
  });

  it('says a failure, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new GatewayError(500, 'could not read the events'));
    expect(await readAudit(AUDIT_DEFAULTS)).toEqual({ state: 'failed', path: auditPath(AUDIT_DEFAULTS), reason: 'could not read the events' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const read = readAudit(AUDIT_DEFAULTS);
    await vi.advanceTimersByTimeAsync(READ_BOUND_MS);
    expect(await read).toEqual({ state: 'slow', path: auditPath(AUDIT_DEFAULTS) });
  });
});
